import { createServer, IncomingMessage, ServerResponse } from 'node:http'

const env = {
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || '',
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY || '',
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
  LOCAL_IMAGE_URL: process.env.LOCAL_IMAGE_URL || 'http://localhost:7860',
  LOCAL_IMAGE_MODEL: process.env.LOCAL_IMAGE_MODEL || '',
}

const hasFirebaseCreds = !!(env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY)

let handler: { fetch: (request: Request, env: Record<string, string>) => Promise<Response> }
try {
  handler = (await import('./api/llm.ts')).default
} catch (err) {
  console.error('Failed to load edge function:', err)
  process.exit(1)
}

if (!hasFirebaseCreds) {
  console.error('⚠  Firebase Admin creds not set — auth verification disabled for local dev')
}

function toWebRequest(req: IncomingMessage, body: string | undefined): Request {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) {
    if (v) headers.set(k, Array.isArray(v) ? v.join(', ') : v)
  }
  return new Request(url.href, { method: req.method, headers, body })
}

async function readBody(req: IncomingMessage): Promise<string | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'DELETE') return undefined
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  return chunks.length > 0 ? Buffer.concat(chunks).toString() : undefined
}

createServer(async (req, res) => {
  const start = Date.now()
  console.error(`[${req.method}] ${req.url}`)
  try {
    const body = await readBody(req)
    const request = toWebRequest(req, body)
    const response = await handler.fetch(request, env)
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()))
    if (response.body) {
      const reader = response.body.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        res.write(value)
      }
    } else {
      const text = await response.text()
      res.write(text)
    }
    res.end()
    console.error(`  → ${response.status} (${Date.now() - start}ms)`)
  } catch (err) {
    console.error(`  ✗ 500:`, err)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }))
  }
}).listen(8787, (err) => {
  if (err) {
    console.error('Failed to start server:', err)
    process.exit(1)
  }
  console.log('Edge function dev server on http://localhost:8787')
})
