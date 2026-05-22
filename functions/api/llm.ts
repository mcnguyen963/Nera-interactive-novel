import admin from 'firebase-admin'
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'
const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'nera-data')

interface Env {
  FIREBASE_PROJECT_ID: string
  FIREBASE_CLIENT_EMAIL: string
  FIREBASE_PRIVATE_KEY: string
  OPENROUTER_API_KEY: string
  LOCAL_IMAGE_URL?: string
  LOCAL_IMAGE_MODEL?: string
}

function signalWithTimeout(ms: number): AbortSignal {
  const ctrl = new AbortController()
  setTimeout(() => ctrl.abort(), ms)
  return ctrl.signal
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_MS = 60_000

function checkRateLimit(uid: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(uid)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(uid, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

function initAdmin(env: Env): void {
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    })
  }
}

async function verifyRequest(request: Request, env: Env): Promise<{ uid: string } | Response> {
  if (!env.FIREBASE_PROJECT_ID) {
    return { uid: 'local-dev' }
  }
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const token = authHeader.slice(7)
  try {
    initAdmin(env)
    const decoded = await admin.auth().verifyIdToken(token)
    if (!decoded.email_verified) {
      return new Response(JSON.stringify({ error: 'Email not verified' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (!checkRateLimit(decoded.uid)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again in 60 seconds.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return { uid: decoded.uid }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid token'
    return new Response(JSON.stringify({ error: message }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function handleChat(request: Request, env: Env): Promise<Response> {
  const body = await request.json().catch(() => ({}))
  const { messages, provider, model, temperature, maxTokens } = body

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'Messages array is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let apiUrl: string
  const apiHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (provider === 'openrouter') {
    apiUrl = `${OPENROUTER_BASE}/chat/completions`
    apiHeaders['Authorization'] = `Bearer ${env.OPENROUTER_API_KEY}`
  } else {
    const baseUrl = ((body as any).localUrl || 'http://localhost:8080').replace(/\/+$/, '')
    apiUrl = `${baseUrl}/chat/completions`
  }

  const apiBody: Record<string, unknown> = {
    model: model || 'openai/gpt-4o-mini',
    messages,
    temperature: temperature ?? 0.9,
    max_tokens: maxTokens ?? 1500,
    stream: true,
  }

  const apiRes = await fetch(apiUrl, {
    method: 'POST',
    headers: apiHeaders,
    body: JSON.stringify(apiBody),
  })

  if (!apiRes.ok) {
    const errText = await apiRes.text().catch(() => 'Unknown error')
    return new Response(JSON.stringify({ error: `LLM API error: ${apiRes.status}`, detail: errText }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const reader = apiRes.body!.getReader()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || !trimmed.startsWith('data: ')) continue
            const data = trimmed.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              const text = parsed.choices?.[0]?.delta?.content || ''
              if (text) {
                controller.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify({ text })}\n\n`))
              }
            } catch {
              // skip unparseable chunks
            }
          }
        }

        // If no SSE text found, try as non-streaming JSON
        const rest = buffer.trim()
        if (rest) {
          try {
            const parsed = JSON.parse(rest)
            const text = parsed.choices?.[0]?.message?.content || parsed.error?.message || ''
            if (text) {
              controller.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify({ text })}\n\n`))
            }
          } catch { /* skip */ }
        }

        controller.enqueue(encoder.encode('event: done\ndata: {"complete": true}\n\n'))
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error'
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: msg })}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

async function handleModels(_request: Request, env: Env): Promise<Response> {
  const res = await fetch(`${OPENROUTER_BASE}/models`, {
    headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
  })
  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'Failed to fetch models' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const data = await res.json()
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  })
}

function isNode(): boolean {
  return typeof process !== 'undefined' && process.versions?.node !== undefined
}

async function saveImageFile(base64Data: string): Promise<string | null> {
  if (!isNode()) return null
  try {
    const imgDir = join(DATA_DIR, 'images')
    await mkdir(imgDir, { recursive: true })
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`
    const raw = base64Data.replace(/^data:image\/\w+;base64,/, '')
    await writeFile(join(imgDir, filename), Buffer.from(raw, 'base64'))
    return `/api/llm/images/${filename}`
  } catch (err) {
    console.error('Failed to save image file:', err)
    return null
  }
}

async function saveStoryFile(storyId: string, data: unknown): Promise<boolean> {
  if (!isNode()) return false
  try {
    const storyDir = join(DATA_DIR, 'stories')
    await mkdir(storyDir, { recursive: true })
    await writeFile(join(storyDir, `${storyId}.json`), JSON.stringify(data, null, 2))
    return true
  } catch (err) {
    console.error('Failed to save story file:', err)
    return false
  }
}

async function loadStoryFile(storyId: string): Promise<unknown | null> {
  if (!isNode()) return null
  try {
    const filePath = join(DATA_DIR, 'stories', `${storyId}.json`)
    if (!existsSync(filePath)) return null
    const content = await readFile(filePath, 'utf-8')
    return JSON.parse(content)
  } catch (err) {
    console.error('Failed to load story file:', err)
    return null
  }
}

async function listStoryFiles(): Promise<string[]> {
  if (!isNode()) return []
  try {
    const storyDir = join(DATA_DIR, 'stories')
    if (!existsSync(storyDir)) return []
    const { readdir } = await import('node:fs/promises')
    const files = await readdir(storyDir)
    return files.filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''))
  } catch {
    return []
  }
}

async function serveImageFile(filename: string): Promise<Response> {
  try {
    const filePath = join(DATA_DIR, 'images', filename)
    if (!existsSync(filePath)) {
      return new Response(JSON.stringify({ error: 'Image not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const ext = filename.split('.').pop()?.toLowerCase() || 'png'
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png'
    const buffer = await readFile(filePath)
    return new Response(buffer, {
      headers: { 'Content-Type': mime, 'Cache-Control': 'public, max-age=86400' },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to serve image' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function handleImage(request: Request, env: Env): Promise<Response> {
  const body = await request.json().catch(() => ({}))
  const { prompt, provider, model, llmUrl, llmModel, imageUrl: bodyImageUrl, comfyWorkflow } = body

  if (!prompt) {
    return new Response(JSON.stringify({ error: 'Prompt is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  async function fallbackDescription(): Promise<string | null> {
    const fallbackUrl = llmUrl || env.LOCAL_LLM_URL || 'http://localhost:8080'
    const fallbackModel = llmModel || env.LOCAL_LLM_MODEL || ''
    const bodies = [
      { model: fallbackModel, messages: [{ role: 'user', content: `Describe the scene in 1-2 sentences based on: ${prompt}` }], max_tokens: 150, temperature: 0.7 },
      { messages: [{ role: 'user', content: `Describe the scene in 1-2 sentences based on: ${prompt}` }], max_tokens: 150, temperature: 0.7 },
      { prompt: `Describe the scene in 1-2 sentences: ${prompt}`, max_tokens: 150, temperature: 0.7 },
    ]
    for (const body of bodies) {
      try {
        const res = await fetch(`${fallbackUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: signalWithTimeout(15_000),
        })
        if (!res.ok) continue
        const data = await res.json()
        const text = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || data.response || data.content || ''
        if (text) return text
      } catch { continue }
    }
    return null
  }

  if (provider === 'cloud') {
    let description = ''
    if (env.OPENROUTER_API_KEY) {
      try {
        const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          },
          body: JSON.stringify({
            model: model || 'openai/gpt-4o-mini',
            messages: [{ role: 'user', content: `Describe the scene in 1-2 sentences based on: ${prompt}` }],
            max_tokens: 200,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          description = data.choices?.[0]?.message?.content || ''
        }
      } catch { /* fall through */ }
    }
    if (!description) {
      const desc = await fallbackDescription()
      description = desc || ''
    }
    return new Response(
      JSON.stringify({ url: null, description }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  }

  const baseUrl = bodyImageUrl || env.LOCAL_IMAGE_URL || 'http://localhost:7860'

  async function trySdWebUi(): Promise<Response | null> {
    try {
      const res = await fetch(`${baseUrl}/sdapi/v1/txt2img`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          negative_prompt: 'text, watermark, low quality, blurry',
          width: 768,
          height: 512,
          steps: 25,
          cfg_scale: 7,
          sampler_name: 'Euler a',
          model: model || env.LOCAL_IMAGE_MODEL || 'flux',
        }),
        signal: signalWithTimeout(120_000),
      })
      if (!res.ok) return null
      const data = await res.json()
      const raw = data.images?.[0] || ''
      if (!raw) return null
      const b64 = raw.startsWith('data:') ? raw.replace(/^data:image\/\w+;base64,/, '') : raw
      const fileUrl = await saveImageFile(b64)
      const url = fileUrl || (raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`)
      return new Response(
        JSON.stringify({ url, description: prompt }),
        { headers: { 'Content-Type': 'application/json' } },
      )
    } catch {
      return null
    }
  }

  async function discoverModels(type: string, cls: string): Promise<string[]> {
    try {
      const res = await fetch(`${baseUrl}/object_info/${cls}`, { signal: signalWithTimeout(5000) })
      if (!res.ok) return []
      const info = await res.json()
      const raw = info?.[cls]?.input?.required?.[type]
      if (Array.isArray(raw)) {
        const list = raw[0]
        if (Array.isArray(list) && list.length > 0) {
          return list.map(String)
        }
      }
    } catch { /* ignore */ }
    return []
  }

  async function buildDefaultWorkflow(): Promise<Record<string, unknown> | null> {
    const checkpoints = await discoverModels('ckpt_name', 'CheckpointLoaderSimple')
    if (checkpoints.length > 0) {
      const ckpt = checkpoints[0]
      return {
        '3': { class_type: 'KSampler', inputs: { seed: Math.floor(Math.random() * 2 ** 32), steps: 25, cfg: 7, sampler_name: 'euler', scheduler: 'normal', denoise: 1, model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0] } },
        '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: ckpt } },
        '5': { class_type: 'EmptyLatentImage', inputs: { width: 768, height: 512, batch_size: 1 } },
        '6': { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['4', 1] } },
        '7': { class_type: 'CLIPTextEncode', inputs: { text: '', clip: ['4', 1] } },
        '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
        '9': { class_type: 'SaveImage', inputs: { filename_prefix: 'nera', images: ['8', 0] } },
      }
    }

    const unets = await discoverModels('unet_name', 'UNETLoader')
    const clips = await discoverModels('clip_name', 'CLIPLoader')
    const vaes = await discoverModels('vae_name', 'VAELoader')

    if (unets.length > 0) {
      const seed = Math.floor(Math.random() * 2 ** 32)
      const clipName = clips.length > 0 ? clips[0] : ''
      const vaeName = vaes.length > 0 ? vaes[0] : ''
      return {
        '1': { class_type: 'RandomNoise', inputs: { noise_seed: seed } },
        '2': { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler' } },
        '3': { class_type: 'Flux2Scheduler', inputs: { steps: 20, width: ['5', 0], height: ['6', 0] } },
        '4': { class_type: 'EmptyFlux2LatentImage', inputs: { width: ['5', 0], height: ['6', 0], batch_size: 1 } },
        '5': { class_type: 'PrimitiveInt', inputs: { value: 1024 } },
        '6': { class_type: 'PrimitiveInt', inputs: { value: 1024 } },
        '7': { class_type: 'UNETLoader', inputs: { unet_name: unets[0] } },
        '8': { class_type: 'CLIPLoader', inputs: { clip_name: clipName, type: 'flux2', device: 'default' } },
        '9': { class_type: 'VAELoader', inputs: { vae_name: vaeName } },
        '10': { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['8', 0] } },
        '11': { class_type: 'CLIPTextEncode', inputs: { text: '', clip: ['8', 0] } },
        '12': { class_type: 'CFGGuider', inputs: { cfg: 5, model: ['7', 0], positive: ['10', 0], negative: ['11', 0] } },
        '13': { class_type: 'SamplerCustomAdvanced', inputs: { noise: ['1', 0], guider: ['12', 0], sampler: ['2', 0], sigmas: ['3', 0], latent_image: ['4', 0] } },
        '14': { class_type: 'VAEDecode', inputs: { samples: ['13', 0], vae: ['9', 0] } },
        '15': { class_type: 'SaveImage', inputs: { filename_prefix: 'nera', images: ['14', 0] } },
      }
    }

    return null
  }

  async function tryComfyUi(): Promise<Response | null> {
    try {
      let workflow: Record<string, unknown>

      if (comfyWorkflow) {
        try {
          const parsed = JSON.parse(comfyWorkflow)
          if (typeof parsed === 'object' && parsed !== null) {
            workflow = parsed
            const PROMPT_MARKER = '__PROMPT__'

            // Check for __PROMPT__ placeholders
            let hasPlaceholder = false
            for (const nodeId of Object.keys(workflow)) {
              const node = workflow[nodeId] as Record<string, unknown> | undefined
              if (!node || typeof node.inputs !== 'object' || node.inputs === null) continue
              const inputs = node.inputs as Record<string, unknown>
              const rawText = typeof inputs.text === 'string' ? inputs.text : typeof inputs.value === 'string' ? inputs.value : ''
              if (rawText.includes(PROMPT_MARKER)) { hasPlaceholder = true; break }
            }

            if (hasPlaceholder) {
              // Replace only nodes with __PROMPT__ marker
              for (const nodeId of Object.keys(workflow)) {
                const node = workflow[nodeId] as Record<string, unknown> | undefined
                if (!node || typeof node.inputs !== 'object' || node.inputs === null) continue
                const inputs = node.inputs as Record<string, unknown>
                if (node.class_type === 'PrimitiveString' || node.class_type === 'PrimitiveStringMultiline' || node.class_type === 'StringPrimitive') {
                  if (typeof inputs.value === 'string' && inputs.value.includes(PROMPT_MARKER)) {
                    inputs.value = prompt
                  }
                }
                if (node.class_type === 'CLIPTextEncode') {
                  if (typeof inputs.text === 'string' && inputs.text.includes(PROMPT_MARKER)) {
                    inputs.text = prompt
                  }
                }
              }
            } else {
              // Identify sampler nodes and trace positive/negative conditioning
              const samplerTypes: string[] = ['KSampler', 'KSamplerAdvanced', 'CFGGuider', 'SamplerCustomAdvanced']
              const positiveNodes = new Set<string>()
              const negativeNodes = new Set<string>()

              for (const nodeId of Object.keys(workflow)) {
                const node = workflow[nodeId] as Record<string, unknown> | undefined
                if (!node || typeof node.inputs !== 'object' || node.inputs === null) continue
                const inputs = node.inputs as Record<string, unknown>
                if (typeof node.class_type === 'string' && samplerTypes.includes(node.class_type)) {
                  const pos = inputs.positive
                  if (Array.isArray(pos) && typeof pos[0] === 'string') positiveNodes.add(pos[0])
                  const neg = inputs.negative
                  if (Array.isArray(neg) && typeof neg[0] === 'string') negativeNodes.add(neg[0])
                }
              }

              // Trace through conditioning nodes to find the ultimate CLIPTextEncode source
              function resolveSource(nodeId: string, visited?: Set<string>): string | null {
                visited = visited || new Set()
                if (visited.has(nodeId)) return null
                visited.add(nodeId)
                const node = workflow[nodeId] as Record<string, unknown> | undefined
                if (!node || typeof node.inputs !== 'object' || node.inputs === null) return null
                if (node.class_type === 'CLIPTextEncode') return nodeId
                const inputs = node.inputs as Record<string, unknown>
                for (const key of Object.keys(inputs)) {
                  const val = inputs[key]
                  if (Array.isArray(val) && typeof val[0] === 'string') {
                    const result = resolveSource(val[0], visited)
                    if (result) return result
                  }
                }
                return null
              }

              // Resolve the actual CLIPTextEncode node for each positive/negative reference
              const resolvedPositive = new Set<string>()
              const resolvedNegative = new Set<string>()
              for (const id of positiveNodes) {
                const resolved = resolveSource(id)
                if (resolved) resolvedPositive.add(resolved)
              }
              for (const id of negativeNodes) {
                const resolved = resolveSource(id)
                if (resolved) resolvedNegative.add(resolved)
              }

              if (resolvedPositive.size > 0 || resolvedNegative.size > 0) {
                // Only replace CLIPTextEncode nodes that feed into positive inputs
                for (const nodeId of Object.keys(workflow)) {
                  const node = workflow[nodeId] as Record<string, unknown> | undefined
                  if (!node || node.class_type !== 'CLIPTextEncode') continue
                  if (typeof node.inputs !== 'object' || node.inputs === null) continue
                  const inputs = node.inputs as Record<string, unknown>
                  if (resolvedPositive.has(nodeId)) {
                    if (typeof inputs.text === 'string') {
                      inputs.text = prompt
                    } else if (Array.isArray(inputs.text)) {
                      inputs.text = prompt
                    }
                  }
                }
              } else {
                // Fallback: no sampler found — replace only the first CLIPTextEncode
                let firstClip = true
                for (const nodeId of Object.keys(workflow)) {
                  const node = workflow[nodeId] as Record<string, unknown> | undefined
                  if (!node || node.class_type !== 'CLIPTextEncode') continue
                  if (typeof node.inputs !== 'object' || node.inputs === null) continue
                  const inputs = node.inputs as Record<string, unknown>
                  if (firstClip) {
                    if (typeof inputs.text === 'string') {
                      inputs.text = prompt
                    } else if (Array.isArray(inputs.text)) {
                      inputs.text = prompt
                    }
                    firstClip = false
                  }
                }
              }
            }
          } else {
            const wf = await buildDefaultWorkflow()
            if (!wf) return null
            workflow = wf
          }
        } catch {
          const wf = await buildDefaultWorkflow()
          if (!wf) return null
          workflow = wf
        }
      } else {
        const wf = await buildDefaultWorkflow()
        if (!wf) return null
        workflow = wf
      }

      const queueRes = await fetch(`${baseUrl}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: workflow }),
        signal: signalWithTimeout(120_000),
      })
      const queueData = await queueRes.json()
      if (!queueRes.ok || queueData.error) {
        const errMsg = queueData.error || queueData?.node_errors ? Object.values(queueData.node_errors as Record<string, unknown>)[0] : ''
        console.error('ComfyUI queue error:', JSON.stringify(queueData))
        return null
      }
      const promptId: string = queueData.prompt_id
      if (!promptId) return null

      for (let attempt = 0; attempt < 60; attempt++) {
        await new Promise((r) => setTimeout(r, 2000))
        const histRes = await fetch(`${baseUrl}/history/${promptId}`, { signal: signalWithTimeout(10_000) })
        if (!histRes.ok) continue
        const hist = await histRes.json()
        const outputs = hist[promptId]?.outputs
        if (!outputs) continue
        for (const nodeId of Object.keys(outputs)) {
          const nodeOut = outputs[nodeId]
          if (nodeOut?.images?.[0]) {
            const img = nodeOut.images[0]
            const imgRes = await fetch(`${baseUrl}/view?filename=${encodeURIComponent(img.filename)}&type=${img.type || 'output'}`, { signal: signalWithTimeout(30_000) })
            if (!imgRes.ok) continue
            const blob = await imgRes.arrayBuffer()
            const bytes = new Uint8Array(blob)
            let binary = ''
            const chunk = 8192
            for (let i = 0; i < bytes.length; i += chunk) {
              binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
            }
            const base64 = btoa(binary)
            const fileUrl = await saveImageFile(base64)
            const url = fileUrl || `data:image/png;base64,${base64}`
            return new Response(
              JSON.stringify({ url, description: prompt }),
              { headers: { 'Content-Type': 'application/json' } },
            )
          }
        }
      }
      return null
    } catch {
      return null
    }
  }

  const result = (await trySdWebUi()) || (await tryComfyUi())
  if (result) return result

  const desc = await fallbackDescription()
  if (desc) {
    return new Response(
      JSON.stringify({ url: null, description: desc }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  }

  return new Response(
    JSON.stringify({ error: 'All image providers failed', url: null, description: '' }),
    { headers: { 'Content-Type': 'application/json' } },
  )
}

async function handleSaveStory(request: Request): Promise<Response> {
  const body = await request.json().catch(() => ({}))
  const { storyId, data } = body
  if (!storyId || !data) {
    return jsonResponse({ error: 'storyId and data required' }, 400)
  }
  await saveStoryFile(storyId, data)
  return jsonResponse({ ok: true })
}

async function handleLoadStory(request: Request): Promise<Response> {
  const body = await request.json().catch(() => ({}))
  const { storyId } = body
  if (!storyId) {
    return jsonResponse({ error: 'storyId required' }, 400)
  }
  const data = await loadStoryFile(storyId)
  if (!data) return jsonResponse({ error: 'Story not found' }, 404)
  return jsonResponse(data)
}

async function handleListStories(): Promise<Response> {
  const ids = await listStoryFiles()
  return jsonResponse({ stories: ids })
}

async function handleDeleteStory(request: Request): Promise<Response> {
  const body = await request.json().catch(() => ({}))
  const { storyId } = body
  if (!storyId) return jsonResponse({ error: 'storyId required' }, 400)
  try {
    const filePath = join(DATA_DIR, 'stories', `${storyId}.json`)
    if (existsSync(filePath)) {
      const { unlink } = await import('node:fs/promises')
      await unlink(filePath)
    }
    return jsonResponse({ ok: true })
  } catch (err) {
    return jsonResponse({ error: 'Failed to delete' }, 500)
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS })
    }

    // Serve saved images via GET
    if (request.method === 'GET' && path.startsWith('/api/llm/images/')) {
      const filename = path.slice('/api/llm/images/'.length)
      if (!filename || filename.includes('..')) {
        return jsonResponse({ error: 'Invalid filename' }, 400)
      }
      const res = await serveImageFile(filename)
      Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v))
      return res
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405)
    }

    const verification = await verifyRequest(request, env)
    if (verification instanceof Response) return verification

    try {
      let response: Response
      switch (path) {
        case '/api/llm/chat':
          response = await handleChat(request, env)
          break
        case '/api/llm/models':
          response = await handleModels(request, env)
          break
        case '/api/llm/image':
          response = await handleImage(request, env)
          break
        case '/api/llm/stories/save':
          response = await handleSaveStory(request)
          break
        case '/api/llm/stories/load':
          response = await handleLoadStory(request)
          break
        case '/api/llm/stories/list':
          response = await handleListStories()
          break
        case '/api/llm/stories/delete':
          response = await handleDeleteStory(request)
          break
        default:
          response = jsonResponse({ error: 'Not found' }, 404)
      }
      Object.entries(CORS_HEADERS).forEach(([k, v]) => response.headers.set(k, v))
      return response
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Internal error'
      return jsonResponse({ error: msg }, 500)
    }
  },
}
