import { describe, it, expect, beforeEach, vi } from 'vitest'

const firebaseMock = vi.hoisted(() => ({
  auth: { currentUser: null as any },
}))

vi.mock('../lib/firebase', () => firebaseMock)

import { streamLlmChat, fetchModels, generateImage, testConnection } from './edgeApi'

describe('edgeApi', () => {
  beforeEach(() => {
    firebaseMock.auth.currentUser = {
      getIdToken: vi.fn(async () => 'valid-token'),
    }
  })

  describe('streamLlmChat', () => {
    it('throws when not authenticated', async () => {
      firebaseMock.auth.currentUser = null
      await expect(
        streamLlmChat(
          { messages: [{ role: 'user', content: 'hi' }], provider: 'openrouter', model: 'gpt-4', temperature: 0.7, maxTokens: 500 },
          vi.fn(),
        ),
      ).rejects.toThrow('Not authenticated')
    })

    it('streams chunks and returns full text', async () => {
      const mockChunks = [
        'data: {"text":"Hello"}\n\n',
        'data: {"text":" world"}\n\n',
        'data: {"complete":true}\n\n',
      ]
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () =>
        new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(mockChunks.join('')))
            controller.close()
          },
        }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
      )

      const onChunk = vi.fn()
      const result = await streamLlmChat(
        { messages: [{ role: 'user', content: 'hi' }], provider: 'openrouter', model: 'gpt-4', temperature: 0.7, maxTokens: 500 },
        onChunk,
      )
      expect(result).toBe('Hello world')
    })

    it('handles aborted signal', async () => {
      const controller = new AbortController()
      controller.abort()
      const onChunk = vi.fn()
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () =>
        new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('data: {"text":"test"}\n\n'))
            controller.close()
          },
        }), { status: 200 })
      )
      const result = await streamLlmChat(
        { messages: [{ role: 'user', content: 'hi' }], provider: 'openrouter', model: 'gpt-4', temperature: 0.7, maxTokens: 500 },
        onChunk,
        controller.signal,
      )
      expect(result).toBe('')
    })
  })

  describe('fetchModels', () => {
    it('returns model list from response', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () =>
        new Response(JSON.stringify({ data: [{ id: 'model-1' }, { id: 'model-2' }] }), { status: 200 }),
      )
      const models = await fetchModels()
      expect(models).toHaveLength(2)
      expect(models[0].id).toBe('model-1')
    })

    it('throws on non-ok response', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () =>
        new Response(null, { status: 500 }),
      )
      await expect(fetchModels()).rejects.toThrow()
    })
  })

  describe('testConnection', () => {
    it('returns true when fetch succeeds', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () => new Response(null, { status: 200 }))
      await expect(testConnection('http://localhost:8080')).resolves.toBe(true)
    })

    it('returns false when fetch returns non-ok', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () => new Response(null, { status: 500 }))
      await expect(testConnection('http://localhost:8080')).resolves.toBe(false)
    })

    it('returns false on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'))
      await expect(testConnection('http://localhost:8080')).resolves.toBe(false)
    })

    it('sends authorization header when apiKey provided', async () => {
      let actualUrl = ''
      let actualAuth = ''
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (input: RequestInfo | URL, init?: RequestInit) => {
        actualUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        actualAuth = ((init?.headers || {}) as Record<string, string>)['Authorization'] || ''
        return new Response(null, { status: 200 })
      })
      await testConnection('http://localhost:8080', 'sk-test')
      expect(actualUrl).toBe('http://localhost:8080')
      expect(actualAuth).toBe('Bearer sk-test')
    })
  })

  describe('generateImage', () => {
    it('sends POST to image endpoint', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(input).toBe('/api/llm/image')
        expect(init?.method).toBe('POST')
        const body = JSON.parse(init?.body as string)
        expect(body.prompt).toBe('a cat')
        expect(body.provider).toBe('cloud')
        expect(body.model).toBe('flux')
        return new Response(JSON.stringify({ data: [{ url: 'http://img' }] }), { status: 200 })
      })
      const res = await generateImage('a cat', 'cloud', 'flux')
      expect(res.ok).toBe(true)
    })
  })
})
