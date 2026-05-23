import { auth } from './firebase'

async function getIdToken(): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')
  return user.getIdToken()
}

async function edgeFetch(path: string, body: unknown): Promise<Response> {
  const token = await getIdToken()
  return fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
}

export async function streamLlmChat(
  params: {
    messages: { role: string; content: string }[]
    provider: string
    model: string
    temperature: number
    maxTokens: number
    localUrl?: string
    apiKey?: string
    customUrl?: string
    customApiKey?: string
  },
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await edgeFetch('/api/llm/chat', params)

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }

  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (signal?.aborted) {
      reader.cancel()
      break
    }

    buffer += value
    const parts = buffer.split('\n\n')
    buffer = parts.pop() || ''

    for (const part of parts) {
      const lines = part.split('\n')
      const dataLine = lines.find((l) => l.startsWith('data: '))
      if (!dataLine) continue

      try {
        const data = JSON.parse(dataLine.slice(6))
        if (data.text !== undefined) {
          fullText += data.text
          onChunk(data.text)
        }
        if (data.complete) return fullText
        if (data.error) throw new Error(data.error)
      } catch (err) {
        if (err instanceof Error && err.message !== 'Unexpected end of JSON input') {
          throw err
        }
      }
    }
  }

  return fullText
}

export async function fetchModels(apiKey?: string): Promise<{ id: string; pricing?: { prompt: string } }[]> {
  const res = await edgeFetch('/api/llm/models', { apiKey })
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`)
  const data = await res.json()
  return data.data || []
}

export async function simpleChat(messages: { role: string; content: string }[], provider: string, model: string, temperature?: number, maxTokens?: number, localUrl?: string, apiKey?: string, customUrl?: string, customApiKey?: string): Promise<string> {
  const res = await edgeFetch('/api/llm/simple-chat', { messages, provider, model, temperature, maxTokens, localUrl, apiKey, customUrl, customApiKey })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  const data = await res.json()
  if (!data.text) {
    const debug = data.debug || JSON.stringify(data).slice(0, 300)
    throw new Error('Empty response. Debug: ' + debug)
  }
  return data.text
}

export async function generateImage(prompt: string, provider: string, model: string, llmUrl?: string, llmModel?: string, imageUrl?: string, comfyWorkflow?: string, apiKey?: string): Promise<Response> {
  return edgeFetch('/api/llm/image', { prompt, provider, model, llmUrl, llmModel, imageUrl, comfyWorkflow, apiKey })
}

export async function saveStory(storyId: string, data: unknown): Promise<Response> {
  return edgeFetch('/api/llm/stories/save', { storyId, data })
}

export async function loadStory(storyId: string): Promise<Response> {
  return edgeFetch('/api/llm/stories/load', { storyId })
}

export async function listStories(): Promise<Response> {
  return edgeFetch('/api/llm/stories/list', {})
}

export async function deleteStory(storyId: string): Promise<Response> {
  return edgeFetch('/api/llm/stories/delete', { storyId })
}

export async function testConnection(url: string, apiKey?: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: apiKey ? { Authorization: 'Bearer ' + apiKey } : {},
      signal: AbortSignal.timeout(8000),
    })
    return res.ok
  } catch {
    return false
  }
}
