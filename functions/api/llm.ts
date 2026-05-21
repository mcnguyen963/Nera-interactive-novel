import admin from 'firebase-admin'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

interface Env {
  FIREBASE_PROJECT_ID: string
  FIREBASE_CLIENT_EMAIL: string
  FIREBASE_PRIVATE_KEY: string
  OPENROUTER_API_KEY: string
  LOCAL_IMAGE_URL?: string
  LOCAL_IMAGE_MODEL?: string
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
    const baseUrl = (body as any).localUrl || 'http://localhost:8080'
    apiUrl = `${baseUrl}/v1/chat/completions`
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

async function handleImage(request: Request, env: Env): Promise<Response> {
  const body = await request.json().catch(() => ({}))
  const { prompt, provider, model } = body

  if (!prompt) {
    return new Response(JSON.stringify({ error: 'Prompt is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (provider === 'cloud') {
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: model || 'openai/gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: `Generate an image based on this description. Describe what you see: ${prompt}`,
          },
        ],
        max_tokens: 1000,
      }),
    })
    const data = await res.json()
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const baseUrl = env.LOCAL_IMAGE_URL || 'http://localhost:7860'
  const targetUrl = `${baseUrl}/sdapi/v1/txt2img`

  const res = await fetch(targetUrl, {
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
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Unknown error')
    return new Response(JSON.stringify({ error: `Image API error: ${res.status}`, detail: errText }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const data = await res.json()
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      })
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Only POST allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const verification = await verifyRequest(request, env)
    if (verification instanceof Response) return verification

    try {
      switch (path) {
        case '/api/llm/chat':
          return handleChat(request, env)
        case '/api/llm/models':
          return handleModels(request, env)
        case '/api/llm/image':
          return handleImage(request, env)
        default:
          return new Response(JSON.stringify({ error: 'Not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Internal error'
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  },
}
