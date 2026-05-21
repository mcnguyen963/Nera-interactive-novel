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

export async function fetchModels(): Promise<{ id: string; pricing?: { prompt: string } }[]> {
  const res = await edgeFetch('/api/llm/models', {})
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`)
  const data = await res.json()
  return data.data || []
}

export async function generateImage(prompt: string, provider: string, model: string): Promise<Response> {
  return edgeFetch('/api/llm/image', { prompt, provider, model })
}
