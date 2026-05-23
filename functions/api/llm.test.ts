import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.hoisted(() => {
  process.env.DATA_DIR = '/tmp/test-nera-data'
})

const shared = vi.hoisted(() => {
  const apps: object[] = []
  const mockVerifyIdToken = vi.fn()
  const mockExistsSync = vi.fn()
  const mockMkdir = vi.fn().mockResolvedValue(undefined)
  const mockWriteFile = vi.fn().mockResolvedValue(undefined)
  const mockReadFile = vi.fn()
  const mockReaddir = vi.fn()
  const mockUnlink = vi.fn().mockResolvedValue(undefined)
  return { apps, mockVerifyIdToken, mockExistsSync, mockMkdir, mockWriteFile, mockReadFile, mockReaddir, mockUnlink }
})

vi.mock('firebase-admin', () => ({
  default: {
    apps: shared.apps,
    initializeApp: vi.fn(() => { shared.apps.push({}) }),
    credential: { cert: vi.fn(() => ({})) },
    auth: vi.fn(() => ({ verifyIdToken: shared.mockVerifyIdToken })),
  },
}))

vi.mock('node:fs', () => ({
  existsSync: shared.mockExistsSync,
}))

vi.mock('node:fs/promises', () => ({
  mkdir: shared.mockMkdir,
  writeFile: shared.mockWriteFile,
  readFile: shared.mockReadFile,
  readdir: shared.mockReaddir,
  unlink: shared.mockUnlink,
}))

import llmHandler from './llm'

const env = {
  FIREBASE_PROJECT_ID: 'test-project',
  FIREBASE_CLIENT_EMAIL: 'test@test.com',
  FIREBASE_PRIVATE_KEY: 'test-key\\nwith-newlines',
  OPENROUTER_API_KEY: 'sk-or-test-key',
}

function mockSSE(chunks: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

async function collectSSE(res: Response): Promise<string[]> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const events: string[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() || ''
    for (const part of parts) {
      if (part.trim()) events.push(part.trim())
    }
  }
  return events
}

function mockJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function readJson(res: Response): Promise<unknown> {
  return JSON.parse(await res.text())
}

// ----------------------------------------------------------------
// REQUEST ROUTING
// ----------------------------------------------------------------
describe('request routing', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    shared.apps.length = 0
    shared.mockVerifyIdToken.mockReset()
    fetchSpy = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('returns CORS for OPTIONS', async () => {
    const req = new Request('http://localhost/api/llm/chat', { method: 'OPTIONS' })
    const res = await llmHandler.fetch(req, env as any)
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST')
  })

  it('routes POST /api/llm/chat to handleChat', async () => {
    shared.mockVerifyIdToken.mockResolvedValue({ uid: 'u1', email_verified: true })
    fetchSpy.mockResolvedValue(mockSSE(['data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n', 'data: [DONE]\n\n']))
    const req = new Request('http://localhost/api/llm/chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
    })
    const res = await llmHandler.fetch(req, env as any)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/event-stream')
  })

  it('routes POST /api/llm/simple-chat to handleSimpleChat', async () => {
    shared.mockVerifyIdToken.mockResolvedValue({ uid: 'u2', email_verified: true })
    fetchSpy.mockResolvedValue(mockJsonResponse({ choices: [{ message: { content: 'Hi' } }] }))
    const req = new Request('http://localhost/api/llm/simple-chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
    })
    const res = await llmHandler.fetch(req, env as any)
    expect(res.status).toBe(200)
    const data = await readJson(res)
    expect(data).toEqual({ text: 'Hi' })
  })

  it('routes POST /api/llm/models to handleModels', async () => {
    shared.mockVerifyIdToken.mockResolvedValue({ uid: 'u3', email_verified: true })
    fetchSpy.mockResolvedValue(mockJsonResponse({ data: [{ id: 'gpt-4' }] }))
    const req = new Request('http://localhost/api/llm/models', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await llmHandler.fetch(req, env as any)
    expect(res.status).toBe(200)
    const data = await readJson(res)
    expect(data).toEqual({ data: [{ id: 'gpt-4' }] })
  })

  it('routes POST /api/llm/image to handleImage', async () => {
    shared.mockVerifyIdToken.mockResolvedValue({ uid: 'u4', email_verified: true })
    fetchSpy.mockResolvedValue(mockJsonResponse({ error: 'All providers failed' }))
    const req = new Request('http://localhost/api/llm/image', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'a cat' }),
    })
    const res = await llmHandler.fetch(req, env as any)
    expect(res.status).toBe(200)
    const data = await readJson(res)
    expect(data).toHaveProperty('error')
  })

  it('routes POST /api/llm/stories/save to handleSaveStory', async () => {
    shared.mockVerifyIdToken.mockResolvedValue({ uid: 'u5', email_verified: true })
    shared.mockExistsSync.mockReturnValue(true)
    shared.mockMkdir.mockResolvedValue(undefined)
    shared.mockWriteFile.mockResolvedValue(undefined)
    const req = new Request('http://localhost/api/llm/stories/save', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ storyId: 's1', data: { title: 'Test' } }),
    })
    const res = await llmHandler.fetch(req, env as any)
    expect(res.status).toBe(200)
    const data = await readJson(res)
    expect(data).toEqual({ ok: true })
  })

  it('routes POST /api/llm/stories/load to handleLoadStory', async () => {
    shared.mockVerifyIdToken.mockResolvedValue({ uid: 'u6', email_verified: true })
    shared.mockExistsSync.mockReturnValue(true)
    shared.mockReadFile.mockResolvedValue(JSON.stringify({ title: 'Loaded' }))
    const req = new Request('http://localhost/api/llm/stories/load', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ storyId: 's1' }),
    })
    const res = await llmHandler.fetch(req, env as any)
    expect(res.status).toBe(200)
    const data = await readJson(res)
    expect(data).toEqual({ title: 'Loaded' })
  })

  it('routes POST /api/llm/stories/list to handleListStories', async () => {
    shared.mockVerifyIdToken.mockResolvedValue({ uid: 'u7', email_verified: true })
    shared.mockExistsSync.mockReturnValue(true)
    shared.mockReaddir.mockResolvedValue(['s1.json', 's2.json'])
    const req = new Request('http://localhost/api/llm/stories/list', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await llmHandler.fetch(req, env as any)
    expect(res.status).toBe(200)
    const data = await readJson(res)
    expect(data).toEqual({ stories: ['s1', 's2'] })
  })

  it('routes POST /api/llm/stories/delete to handleDeleteStory', async () => {
    shared.mockVerifyIdToken.mockResolvedValue({ uid: 'u8', email_verified: true })
    shared.mockExistsSync.mockReturnValue(true)
    const req = new Request('http://localhost/api/llm/stories/delete', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ storyId: 's1' }),
    })
    const res = await llmHandler.fetch(req, env as any)
    expect(res.status).toBe(200)
    const data = await readJson(res)
    expect(data).toEqual({ ok: true })
  })

  it('returns 405 for non-POST non-GET non-OPTIONS', async () => {
    const req = new Request('http://localhost/api/llm/chat', { method: 'PUT' })
    const res = await llmHandler.fetch(req, env as any)
    expect(res.status).toBe(405)
    const data = await readJson(res)
    expect(data).toHaveProperty('error')
  })

  it('returns 404 for unknown routes', async () => {
    shared.mockVerifyIdToken.mockResolvedValue({ uid: 'u9', email_verified: true })
    const req = new Request('http://localhost/api/llm/unknown', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
    })
    const res = await llmHandler.fetch(req, env as any)
    expect(res.status).toBe(404)
    const data = await readJson(res)
    expect(data).toEqual({ error: 'Not found' })
  })

  it('adds CORS headers to all responses', async () => {
    shared.mockVerifyIdToken.mockResolvedValue({ uid: 'u10', email_verified: true })
    fetchSpy.mockResolvedValue(mockJsonResponse({ data: [] }))
    const req = new Request('http://localhost/api/llm/models', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
      body: JSON.stringify({}),
    })
    const res = await llmHandler.fetch(req, env as any)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })
})

// ----------------------------------------------------------------
// AUTHENTICATION
// ----------------------------------------------------------------
describe('authentication', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    shared.apps.length = 0
    shared.mockVerifyIdToken.mockReset()
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({ choices: [{ message: { content: 'ok' } }] })
    )
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('bypasses auth when FIREBASE_PROJECT_ID is not set', async () => {
    const noFirebaseEnv = {
      ...env,
      FIREBASE_PROJECT_ID: '',
      FIREBASE_CLIENT_EMAIL: '',
      FIREBASE_PRIVATE_KEY: '',
    }
    const req = new Request('http://localhost/api/llm/simple-chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    })
    const res = await llmHandler.fetch(req, noFirebaseEnv as any)
    expect(res.status).toBe(200)
    expect(shared.mockVerifyIdToken).not.toHaveBeenCalled()
  })

  it('returns 401 when Authorization header is missing', async () => {
    const req = new Request('http://localhost/api/llm/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    })
    const res = await llmHandler.fetch(req, env as any)
    expect(res.status).toBe(401)
    const data = await readJson(res)
    expect(data).toEqual({ error: 'Missing or invalid Authorization header' })
  })

  it('returns 401 when Authorization header is not Bearer', async () => {
    const req = new Request('http://localhost/api/llm/chat', {
      method: 'POST',
      headers: { Authorization: 'Basic abc' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    })
    const res = await llmHandler.fetch(req, env as any)
    expect(res.status).toBe(401)
  })

  it('returns 401 when token verification fails', async () => {
    shared.mockVerifyIdToken.mockRejectedValue(new Error('Token expired'))
    const req = new Request('http://localhost/api/llm/chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer bad-token' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    })
    const res = await llmHandler.fetch(req, env as any)
    expect(res.status).toBe(401)
    const data = await readJson(res)
    expect(data.error).toContain('Token expired')
  })

  it('returns 403 when email is not verified', async () => {
    shared.mockVerifyIdToken.mockResolvedValue({ uid: 'u1', email_verified: false })
    const req = new Request('http://localhost/api/llm/chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    })
    const res = await llmHandler.fetch(req, env as any)
    expect(res.status).toBe(403)
    const data = await readJson(res)
    expect(data).toEqual({ error: 'Email not verified' })
  })

  it('returns 429 when rate limit is exceeded', async () => {
    shared.mockVerifyIdToken.mockResolvedValue({ uid: 'rate-limited-user', email_verified: true })
    const body = JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] })
    for (let i = 0; i < 20; i++) {
      const req = new Request('http://localhost/api/llm/chat', {
        method: 'POST',
        headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
        body,
      })
      const res = await llmHandler.fetch(req, env as any)
      expect(res.status).toBe(200)
    }
    const finalReq = new Request('http://localhost/api/llm/chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body,
    })
    const res = await llmHandler.fetch(finalReq, env as any)
    expect(res.status).toBe(429)
    const data = await readJson(res)
    expect(data.error).toContain('Rate limit')
  })
})

// ----------------------------------------------------------------
// CHAT STREAMING  (handleChat)
// ----------------------------------------------------------------
describe('handleChat', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    shared.apps.length = 0
    shared.mockVerifyIdToken.mockReset()
    shared.mockVerifyIdToken.mockResolvedValue({ uid: 'chat-user', email_verified: true })
    fetchSpy = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('returns 400 when messages array is missing', async () => {
    fetchSpy.mockResolvedValue(mockSSE([]))
    const req = new Request('http://localhost/api/llm/chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await llmHandler.fetch(req, env as any)
    expect(res.status).toBe(400)
    const data = await readJson(res)
    expect(data).toEqual({ error: 'Messages array is required' })
  })

  it('returns 400 when messages is empty array', async () => {
    fetchSpy.mockResolvedValue(mockSSE([]))
    const req = new Request('http://localhost/api/llm/chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [] }),
    })
    const res = await llmHandler.fetch(req, env as any)
    expect(res.status).toBe(400)
  })

  it('sends correct request to OpenRouter with default params', async () => {
    fetchSpy.mockResolvedValue(mockSSE(['data: [DONE]\n\n']))
    const req = new Request('http://localhost/api/llm/chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], provider: 'openrouter' }),
    })
    await llmHandler.fetch(req, env as any)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(opts.method).toBe('POST')
    expect(opts.headers).toHaveProperty('Authorization', 'Bearer sk-or-test-key')
    const body = JSON.parse(opts.body as string)
    expect(body.model).toBe('openai/gpt-oss-120b:free')
    expect(body.stream).toBe(true)
    expect(body.temperature).toBe(0.9)
    expect(body.max_tokens).toBe(1500)
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }])
  })

  it('uses apiKey from request body when provided for openrouter', async () => {
    fetchSpy.mockResolvedValue(mockSSE(['data: [DONE]\n\n']))
    const req = new Request('http://localhost/api/llm/chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], provider: 'openrouter', apiKey: 'custom-key' }),
    })
    await llmHandler.fetch(req, env as any)
    const [, opts] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const headers = opts.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer custom-key')
  })

  it('sends request to local provider when no provider specified', async () => {
    fetchSpy.mockResolvedValue(mockSSE(['data: [DONE]\n\n']))
    const req = new Request('http://localhost/api/llm/chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    })
    await llmHandler.fetch(req, env as any)
    const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:8080/chat/completions')
    expect((opts.headers as Record<string, string>)['Authorization']).toBeUndefined()
  })

  it('uses custom local URL when localUrl is provided', async () => {
    fetchSpy.mockResolvedValue(mockSSE(['data: [DONE]\n\n']))
    const req = new Request('http://localhost/api/llm/chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], localUrl: 'http://my-server:9090' }),
    })
    await llmHandler.fetch(req, env as any)
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://my-server:9090/chat/completions')
  })

  it('uses custom provider URL when custom provider is specified', async () => {
    fetchSpy.mockResolvedValue(mockSSE(['data: [DONE]\n\n']))
    const req = new Request('http://localhost/api/llm/chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], provider: 'custom', customUrl: 'http://custom.ai', customApiKey: 'ckey' }),
    })
    await llmHandler.fetch(req, env as any)
    const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://custom.ai/chat/completions')
    const headers = opts.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer ckey')
  })

  it('strips trailing slashes from custom/local URLs', async () => {
    fetchSpy.mockResolvedValue(mockSSE(['data: [DONE]\n\n']))
    const req = new Request('http://localhost/api/llm/chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], localUrl: 'http://server:8080///' }),
    })
    await llmHandler.fetch(req, env as any)
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://server:8080/chat/completions')
  })

  it('uses custom model, temperature, and maxTokens from request', async () => {
    fetchSpy.mockResolvedValue(mockSSE(['data: [DONE]\n\n']))
    const req = new Request('http://localhost/api/llm/chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], model: 'my-model', temperature: 0.5, maxTokens: 500 }),
    })
    await llmHandler.fetch(req, env as any)
    const [, opts] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(opts.body as string)
    expect(body.model).toBe('my-model')
    expect(body.temperature).toBe(0.5)
    expect(body.max_tokens).toBe(500)
  })

  it('returns SSE stream with message events', async () => {
    const sseData = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
      'data: [DONE]\n\n',
    ]
    fetchSpy.mockResolvedValue(mockSSE(sseData))
    const req = new Request('http://localhost/api/llm/chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    })
    const res = await llmHandler.fetch(req, env as any)
    const events = await collectSSE(res)
    expect(events).toHaveLength(3)
    expect(events[0]).toContain('event: message')
    expect(events[0]).toContain('"Hello"')
    expect(events[1]).toContain('" world"')
    expect(events[2]).toContain('event: done')
    expect(events[2]).toContain('"complete": true')
  })

  it('handles non-streaming JSON response as fallback', async () => {
    fetchSpy.mockResolvedValue(
      mockJsonResponse({ choices: [{ message: { content: 'Non-stream reply' } }] })
    )
    const req = new Request('http://localhost/api/llm/chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    })
    const res = await llmHandler.fetch(req, env as any)
    const events = await collectSSE(res)
    const msgEvents = events.filter((e) => e.startsWith('event: message'))
    expect(msgEvents).toHaveLength(1)
    expect(msgEvents[0]).toContain('Non-stream reply')
  })

  it('returns 502 when upstream API errors', async () => {
    fetchSpy.mockResolvedValue(mockJsonResponse({ error: 'Bad Request' }, 400))
    const req = new Request('http://localhost/api/llm/chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    })
    const res = await llmHandler.fetch(req, env as any)
    expect(res.status).toBe(502)
    const data = await readJson(res)
    expect(data.error).toContain('LLM API error: 400')
  })

  it('sends error event when stream reading fails', async () => {
    const badStream = new ReadableStream({
      start(controller) {
        controller.error(new Error('Stream exploded'))
      },
    })
    fetchSpy.mockResolvedValue(
      new Response(badStream, { headers: { 'Content-Type': 'text/event-stream' } })
    )
    const req = new Request('http://localhost/api/llm/chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    })
    const res = await llmHandler.fetch(req, env as any)
    const events = await collectSSE(res)
    const errorEvents = events.filter((e) => e.startsWith('event: error'))
    expect(errorEvents.length).toBeGreaterThanOrEqual(1)
  })

  it('handles error response from non-streaming fallback with error field', async () => {
    fetchSpy.mockResolvedValue(
      mockJsonResponse({ error: { message: 'Rate limit hit' } })
    )
    const req = new Request('http://localhost/api/llm/chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    })
    const res = await llmHandler.fetch(req, env as any)
    const events = await collectSSE(res)
    const msgEvents = events.filter((e) => e.startsWith('event: message'))
    expect(msgEvents[0]).toContain('Rate limit hit')
  })
})

// ----------------------------------------------------------------
// SIMPLE CHAT (handleSimpleChat)
// ----------------------------------------------------------------
describe('handleSimpleChat', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    shared.apps.length = 0
    shared.mockVerifyIdToken.mockReset()
    shared.mockVerifyIdToken.mockResolvedValue({ uid: 'sc-user', email_verified: true })
    fetchSpy = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('returns 400 when messages missing', async () => {
    fetchSpy.mockResolvedValue(mockJsonResponse({}))
    const req = new Request('http://localhost/api/llm/simple-chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await llmHandler.fetch(req, env as any)
    expect(res.status).toBe(400)
  })

  it('returns text from successful response', async () => {
    fetchSpy.mockResolvedValue(mockJsonResponse({ choices: [{ message: { content: 'Hello world' } }] }))
    const req = new Request('http://localhost/api/llm/simple-chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    })
    const res = await llmHandler.fetch(req, env as any)
    expect(res.status).toBe(200)
    const data = await readJson(res)
    expect(data).toEqual({ text: 'Hello world' })
  })

  it('falls back to alternative URL paths for local provider', async () => {
    fetchSpy
      .mockResolvedValueOnce(mockJsonResponse({ error: 'not found' }, 404))
      .mockResolvedValueOnce(mockJsonResponse({ choices: [{ message: { content: 'Fallback worked' } }] }))
    const req = new Request('http://localhost/api/llm/simple-chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    })
    const res = await llmHandler.fetch(req, env as any)
    expect(res.status).toBe(200)
    const data = await readJson(res)
    expect(data).toEqual({ text: 'Fallback worked' })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    const [url1] = fetchSpy.mock.calls[0] as [string]
    const [url2] = fetchSpy.mock.calls[1] as [string]
    expect(url1).toContain('/v1/chat/completions')
    expect(url2).toContain('/chat/completions')
  })

  it('returns 502 when all URLs fail', async () => {
    fetchSpy.mockResolvedValue(mockJsonResponse({ error: 'down' }, 503))
    const req = new Request('http://localhost/api/llm/simple-chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    })
    const res = await llmHandler.fetch(req, env as any)
    expect(res.status).toBe(502)
    const data = await readJson(res)
    expect(data.error).toContain('LLM API')
  })

  it('uses different response field extraction patterns', async () => {
    fetchSpy.mockResolvedValue(mockJsonResponse({ choices: [{ text: 'legacy format' }] }))
    const req = new Request('http://localhost/api/llm/simple-chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    })
    const res = await llmHandler.fetch(req, env as any)
    const data = await readJson(res)
    expect(data).toEqual({ text: 'legacy format' })
  })

  it('uses response field when choices missing', async () => {
    fetchSpy.mockResolvedValue(mockJsonResponse({ response: 'direct response field' }))
    const req = new Request('http://localhost/api/llm/simple-chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    })
    const res = await llmHandler.fetch(req, env as any)
    const data = await readJson(res)
    expect(data).toEqual({ text: 'direct response field' })
  })
})

// ----------------------------------------------------------------
// MODEL LISTING (handleModels)
// ----------------------------------------------------------------
describe('handleModels', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    shared.apps.length = 0
    shared.mockVerifyIdToken.mockReset()
    shared.mockVerifyIdToken.mockResolvedValue({ uid: 'm-user', email_verified: true })
    fetchSpy = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('returns models from OpenRouter', async () => {
    const modelList = { data: [{ id: 'gpt-4' }, { id: 'claude-3' }] }
    fetchSpy.mockResolvedValue(mockJsonResponse(modelList))
    const req = new Request('http://localhost/api/llm/models', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await llmHandler.fetch(req, env as any)
    expect(res.status).toBe(200)
    const data = await readJson(res)
    expect(data).toEqual(modelList)
    const [url] = fetchSpy.mock.calls[0] as [string]
    expect(url).toBe('https://openrouter.ai/api/v1/models')
  })

  it('uses apiKey from request body for model listing', async () => {
    fetchSpy.mockResolvedValue(mockJsonResponse({ data: [] }))
    const req = new Request('http://localhost/api/llm/models', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: 'custom-key' }),
    })
    await llmHandler.fetch(req, env as any)
    const [, opts] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const headers = opts.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer custom-key')
  })

  it('returns 502 when OpenRouter returns error', async () => {
    fetchSpy.mockResolvedValue(mockJsonResponse({ error: 'Unauthorized' }, 401))
    const req = new Request('http://localhost/api/llm/models', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await llmHandler.fetch(req, env as any)
    expect(res.status).toBe(502)
    const data = await readJson(res)
    expect(data).toEqual({ error: 'Failed to fetch models' })
  })
})

// ----------------------------------------------------------------
// IMAGE GENERATION (handleImage)
// ----------------------------------------------------------------
describe('handleImage', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    shared.apps.length = 0
    shared.mockVerifyIdToken.mockReset()
    shared.mockVerifyIdToken.mockResolvedValue({ uid: 'img-user', email_verified: true })
    fetchSpy = vi.spyOn(globalThis, 'fetch')
    shared.mockExistsSync.mockReset()
    shared.mockMkdir.mockReset()
    shared.mockWriteFile.mockReset()
    shared.mockReadFile.mockReset()
    shared.mockMkdir.mockResolvedValue(undefined)
    shared.mockWriteFile.mockResolvedValue(undefined)
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('returns 400 when prompt is missing', async () => {
    const req = new Request('http://localhost/api/llm/image', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await llmHandler.fetch(req, env as any)
    expect(res.status).toBe(400)
    const data = await readJson(res)
    expect(data).toEqual({ error: 'Prompt is required' })
  })

  it('cloud provider returns description via OpenRouter', async () => {
    fetchSpy.mockResolvedValue(
      mockJsonResponse({ choices: [{ message: { content: 'A scenic landscape' } }] })
    )
    const req = new Request('http://localhost/api/llm/image', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'landscape', provider: 'cloud' }),
    })
    const res = await llmHandler.fetch(req, env as any)
    expect(res.status).toBe(200)
    const data = await readJson(res)
    expect(data).toEqual({ url: null, description: 'A scenic landscape' })
  })

  it('cloud provider falls back to local LLM when OpenRouter fails', async () => {
    fetchSpy
      .mockResolvedValueOnce(mockJsonResponse({ error: 'unauthorized' }, 401))
      .mockResolvedValueOnce(mockJsonResponse({ choices: [{ message: { content: 'Local desc' } }] }))
    const req = new Request('http://localhost/api/llm/image', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'landscape', provider: 'cloud' }),
    })
    const res = await llmHandler.fetch(req, env as any)
    expect(res.status).toBe(200)
    const data = await readJson(res)
    expect(data.description).toBe('Local desc')
  })

  it('SD WebUI generates image successfully', async () => {
    shared.mockWriteFile.mockResolvedValue(undefined)
    fetchSpy.mockResolvedValue(
      mockJsonResponse({ images: ['iVBORw0KGgo='] })
    )
    const req = new Request('http://localhost/api/llm/image', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'a cat' }),
    })
    const res = await llmHandler.fetch(req, env as any)
    expect(res.status).toBe(200)
    const data = await readJson(res)
    expect(data).toHaveProperty('url')
    expect(data.description).toBe('a cat')
    const [sdUrl] = fetchSpy.mock.calls[0] as [string]
    expect(sdUrl).toContain('/sdapi/v1/txt2img')
  })

  it('SD WebUI uses custom image URL and model from env', async () => {
    const customEnv = { ...env, LOCAL_IMAGE_URL: 'http://custom-sd:7860', LOCAL_IMAGE_MODEL: 'sdxl' }
    fetchSpy.mockResolvedValue(mockJsonResponse({ images: ['base64data'] }))
    const req = new Request('http://localhost/api/llm/image', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'a cat' }),
    })
    await llmHandler.fetch(req, customEnv as any)
    const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('custom-sd:7860')
    const body = JSON.parse(opts.body as string)
    expect(body.model).toBe('sdxl')
  })

  it('ComfyUI generates image via default workflow with checkpoints', async () => {
    const comfyEnv = { ...env, LOCAL_IMAGE_URL: 'http://comfy:8188' }
    fetchSpy
      .mockResolvedValueOnce(mockJsonResponse({ error: 'sd failed' }, 500))
      .mockResolvedValueOnce(mockJsonResponse({
        'CheckpointLoaderSimple': { input: { required: { ckpt_name: [['sd_xl.safetensors'], {}] } } }
      }))
      .mockResolvedValueOnce(mockJsonResponse({ prompt_id: 'p123' }))
      .mockResolvedValueOnce(mockJsonResponse({
        p123: { outputs: { '9': { images: [{ filename: 'nera_0001.png', type: 'output' }] } } }
      }))
      .mockResolvedValueOnce(new Response(new ArrayBuffer(8), { headers: { 'Content-Type': 'image/png' } }))
    shared.mockWriteFile.mockResolvedValue(undefined)
    shared.mockExistsSync.mockReturnValue(true)
    const req = new Request('http://localhost/api/llm/image', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'comfy cat' }),
    })
    const res = await llmHandler.fetch(req, comfyEnv as any)
    expect(res.status).toBe(200)
    const data = await readJson(res)
    expect(data).toHaveProperty('url')
    expect(data.description).toBe('comfy cat')
  })

  it('ComfyUI uses provided workflow with __PROMPT__ placeholder', async () => {
    const customWorkflow = JSON.stringify({
      '6': { class_type: 'CLIPTextEncode', inputs: { text: '__PROMPT__', clip: ['4', 1] } },
      '3': { class_type: 'KSampler', inputs: { seed: 42, steps: 20, cfg: 7, sampler_name: 'euler', scheduler: 'normal', denoise: 1, model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0] } },
      '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'model.safetensors' } },
      '5': { class_type: 'EmptyLatentImage', inputs: { width: 512, height: 512, batch_size: 1 } },
      '7': { class_type: 'CLIPTextEncode', inputs: { text: '', clip: ['4', 1] } },
      '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
      '9': { class_type: 'SaveImage', inputs: { filename_prefix: 'nera', images: ['8', 0] } },
    })
    const comfyEnv = { ...env, LOCAL_IMAGE_URL: 'http://comfy:8188' }
    fetchSpy
      .mockResolvedValueOnce(mockJsonResponse({ error: 'sd failed' }, 500))
      .mockResolvedValueOnce(mockJsonResponse({ prompt_id: 'p456' }))
      .mockResolvedValueOnce(mockJsonResponse({
        p456: { outputs: { '9': { images: [{ filename: 'nera_0001.png', type: 'output' }] } } }
      }))
      .mockResolvedValueOnce(new Response(new ArrayBuffer(8), { headers: { 'Content-Type': 'image/png' } }))
    shared.mockWriteFile.mockResolvedValue(undefined)
    const req = new Request('http://localhost/api/llm/image', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'custom workflow cat', comfyWorkflow: customWorkflow }),
    })
    const res = await llmHandler.fetch(req, comfyEnv as any)
    expect(res.status).toBe(200)
    const data = await readJson(res)
    expect(data).toHaveProperty('url')
    const queueCall = fetchSpy.mock.calls.find(c => (c[0] as string).includes('/prompt'))
    const queueBody = JSON.parse((queueCall![1] as RequestInit).body as string)
    const clipInput = queueBody.prompt['6'].inputs.text
    expect(clipInput).toBe('custom workflow cat')
  })

  it('ComfyUI injects prompt into first CLIPTextEncode when no sampler found', async () => {
    const workflowNoSampler = JSON.stringify({
      '1': { class_type: 'CLIPTextEncode', inputs: { text: 'default prompt', clip: ['2', 0] } },
      '2': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'model.safetensors' } },
      '3': { class_type: 'VAEDecode', inputs: { samples: ['4', 0], vae: ['2', 2] } },
      '4': { class_type: 'SomeCustomNode', inputs: { model: ['2', 0], positive: ['1', 0] } },
    })
    fetchSpy
      .mockResolvedValueOnce(mockJsonResponse({ error: 'sd failed' }, 500))
      .mockResolvedValueOnce(mockJsonResponse({ prompt_id: 'p789' }))
      .mockResolvedValueOnce(mockJsonResponse({
        p789: { outputs: { '9': { images: [{ filename: 'test.png', type: 'output' }] } } }
      }))
      .mockResolvedValueOnce(new Response(new ArrayBuffer(8), { headers: { 'Content-Type': 'image/png' } }))
    shared.mockWriteFile.mockResolvedValue(undefined)
    const req = new Request('http://localhost/api/llm/image', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'injected prompt', comfyWorkflow: workflowNoSampler }),
    })
    const res = await llmHandler.fetch(req, env as any)
    expect(res.status).toBe(200)
    const data = await readJson(res)
    expect(data).toHaveProperty('url')
  })

  it('returns description from fallback when all providers fail', async () => {
    fetchSpy.mockImplementation((url: string) => {
      const u = typeof url === 'string' ? url : ''
      if (u.includes('sdapi/v1/txt2img') || u.includes('object_info')) {
        return Promise.resolve(mockJsonResponse({ error: 'down' }, 500))
      }
      if (u.includes('/v1/chat/completions') || u.includes('/chat/completions')) {
        return Promise.resolve(mockJsonResponse({ choices: [{ message: { content: 'Fallback description' } }] }))
      }
      return Promise.resolve(mockJsonResponse({ error: 'unmocked' }, 500))
    })
    const req = new Request('http://localhost/api/llm/image', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'test' }),
    })
    const res = await llmHandler.fetch(req, env as any)
    expect(res.status).toBe(200)
    const data = await readJson(res)
    expect(data).toEqual({ url: null, description: 'Fallback description' })
  })

  it('returns error when all providers and fallback fail', async () => {
    fetchSpy.mockResolvedValue(mockJsonResponse({ error: 'error' }, 500))
    const req = new Request('http://localhost/api/llm/image', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'test' }),
    })
    const res = await llmHandler.fetch(req, env as any)
    expect(res.status).toBe(200)
    const data = await readJson(res)
    expect(data).toHaveProperty('error', 'All image providers failed')
  })

  it('uses body imageUrl when provided', async () => {
    fetchSpy.mockResolvedValue(mockJsonResponse({ images: ['base64data'] }))
    const req = new Request('http://localhost/api/llm/image', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'test', imageUrl: 'http://my-image-server:7860' }),
    })
    await llmHandler.fetch(req, env as any)
    const [url] = fetchSpy.mock.calls[0] as [string]
    expect(url).toContain('my-image-server:7860')
  })
})

// ----------------------------------------------------------------
// STORY CRUD
// ----------------------------------------------------------------
describe('story CRUD', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    shared.apps.length = 0
    shared.mockVerifyIdToken.mockReset()
    shared.mockVerifyIdToken.mockResolvedValue({ uid: 'story-user', email_verified: true })
    fetchSpy = vi.spyOn(globalThis, 'fetch')
    shared.mockExistsSync.mockReset()
    shared.mockMkdir.mockReset().mockResolvedValue(undefined)
    shared.mockWriteFile.mockReset().mockResolvedValue(undefined)
    shared.mockReadFile.mockReset()
    shared.mockReaddir.mockReset()
    shared.mockUnlink.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  describe('save', () => {
    it('returns 400 when storyId missing', async () => {
      const req = new Request('http://localhost/api/llm/stories/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { x: 1 } }),
      })
      const res = await llmHandler.fetch(req, env as any)
      expect(res.status).toBe(400)
    })

    it('returns 400 when data missing', async () => {
      const req = new Request('http://localhost/api/llm/stories/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId: 's1' }),
      })
      const res = await llmHandler.fetch(req, env as any)
      expect(res.status).toBe(400)
    })

    it('saves story successfully', async () => {
      const req = new Request('http://localhost/api/llm/stories/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId: 'story-1', data: { title: 'My Story', scenes: [] } }),
      })
      const res = await llmHandler.fetch(req, env as any)
      expect(res.status).toBe(200)
      const data = await readJson(res)
      expect(data).toEqual({ ok: true })
      expect(shared.mockWriteFile).toHaveBeenCalled()
      const writeCall = shared.mockWriteFile.mock.calls[0]
      expect(writeCall[0]).toContain('story-1.json')
    })
  })

  describe('load', () => {
    it('returns 400 when storyId missing', async () => {
      const req = new Request('http://localhost/api/llm/stories/load', {
        method: 'POST',
        headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const res = await llmHandler.fetch(req, env as any)
      expect(res.status).toBe(400)
    })

    it('loads story successfully', async () => {
      const storyData = { title: 'Loaded Story', scenes: [{ id: 1, text: 'Once upon a time' }] }
      shared.mockExistsSync.mockReturnValue(true)
      shared.mockReadFile.mockResolvedValue(JSON.stringify(storyData))
      const req = new Request('http://localhost/api/llm/stories/load', {
        method: 'POST',
        headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId: 'story-1' }),
      })
      const res = await llmHandler.fetch(req, env as any)
      expect(res.status).toBe(200)
      const data = await readJson(res)
      expect(data).toEqual(storyData)
    })

    it('returns 404 when story not found', async () => {
      shared.mockExistsSync.mockReturnValue(false)
      const req = new Request('http://localhost/api/llm/stories/load', {
        method: 'POST',
        headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId: 'nonexistent' }),
      })
      const res = await llmHandler.fetch(req, env as any)
      expect(res.status).toBe(404)
      const data = await readJson(res)
      expect(data).toEqual({ error: 'Story not found' })
    })
  })

  describe('list', () => {
    it('returns list of story IDs', async () => {
      shared.mockExistsSync.mockReturnValue(true)
      shared.mockReaddir.mockResolvedValue(['s1.json', 's2.json', 'notes.txt'])
      const req = new Request('http://localhost/api/llm/stories/list', {
        method: 'POST',
        headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const res = await llmHandler.fetch(req, env as any)
      expect(res.status).toBe(200)
      const data = await readJson(res)
      expect(data).toEqual({ stories: ['s1', 's2'] })
    })

    it('returns empty list when directory does not exist', async () => {
      shared.mockExistsSync.mockReturnValue(false)
      const req = new Request('http://localhost/api/llm/stories/list', {
        method: 'POST',
        headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const res = await llmHandler.fetch(req, env as any)
      expect(res.status).toBe(200)
      const data = await readJson(res)
      expect(data).toEqual({ stories: [] })
    })
  })

  describe('delete', () => {
    it('returns 400 when storyId missing', async () => {
      const req = new Request('http://localhost/api/llm/stories/delete', {
        method: 'POST',
        headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const res = await llmHandler.fetch(req, env as any)
      expect(res.status).toBe(400)
    })

    it('deletes story successfully', async () => {
      shared.mockExistsSync.mockReturnValue(true)
      const req = new Request('http://localhost/api/llm/stories/delete', {
        method: 'POST',
        headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId: 'story-1' }),
      })
      const res = await llmHandler.fetch(req, env as any)
      expect(res.status).toBe(200)
      const data = await readJson(res)
      expect(data).toEqual({ ok: true })
      expect(shared.mockUnlink).toHaveBeenCalled()
    })

    it('handles non-existent story gracefully', async () => {
      shared.mockExistsSync.mockReturnValue(false)
      const req = new Request('http://localhost/api/llm/stories/delete', {
        method: 'POST',
        headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId: 'nonexistent' }),
      })
      const res = await llmHandler.fetch(req, env as any)
      expect(res.status).toBe(200)
    })
  })
})

// ----------------------------------------------------------------
// IMAGE SERVING
// ----------------------------------------------------------------
describe('image serving via GET', () => {
  beforeEach(() => {
    shared.mockExistsSync.mockReset()
    shared.mockReadFile.mockReset()
  })

  it('serves an existing image file', async () => {
    shared.mockExistsSync.mockReturnValue(true)
    shared.mockReadFile.mockResolvedValue(Buffer.from('fake-image-bytes'))
    const req = new Request('http://localhost/api/llm/images/photo.png')
    const res = await llmHandler.fetch(req, { ...env, FIREBASE_PROJECT_ID: '' } as any)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/png')
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400')
  })

  it('returns 404 for missing image', async () => {
    shared.mockExistsSync.mockReturnValue(false)
    const req = new Request('http://localhost/api/llm/images/missing.png')
    const res = await llmHandler.fetch(req, { ...env, FIREBASE_PROJECT_ID: '' } as any)
    expect(res.status).toBe(404)
    const data = await readJson(res)
    expect(data).toEqual({ error: 'Image not found' })
  })

  it('returns 400 for path traversal attempt', async () => {
    const req = new Request('http://localhost/api/llm/images/test...png')
    const res = await llmHandler.fetch(req, { ...env, FIREBASE_PROJECT_ID: '' } as any)
    expect(res.status).toBe(400)
    const data = await readJson(res)
    expect(data).toEqual({ error: 'Invalid filename' })
  })

  it('serves jpg with correct mime type', async () => {
    shared.mockExistsSync.mockReturnValue(true)
    shared.mockReadFile.mockResolvedValue(Buffer.from('fake-jpg'))
    const req = new Request('http://localhost/api/llm/images/photo.jpg')
    const res = await llmHandler.fetch(req, { ...env, FIREBASE_PROJECT_ID: '' } as any)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/jpeg')
  })

  it('serves webp with correct mime type', async () => {
    shared.mockExistsSync.mockReturnValue(true)
    shared.mockReadFile.mockResolvedValue(Buffer.from('fake-webp'))
    const req = new Request('http://localhost/api/llm/images/photo.webp')
    const res = await llmHandler.fetch(req, { ...env, FIREBASE_PROJECT_ID: '' } as any)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/webp')
  })
})
