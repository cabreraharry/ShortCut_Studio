import { net } from 'electron'
import { redactSecrets } from '../../security/redact'

export interface HttpJsonRequest {
  url: string
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: unknown
  signal?: AbortSignal
}

// Strip query-string values that commonly carry secrets (key, api_key, token,
// access_token) before the URL is embedded in an error message. Any provider
// that passes credentials in the URL (e.g., Gemini's ?key=) would otherwise
// leak them into main-process logs when a request fails.
const REDACTED_PARAMS = /^(key|api[_-]?key|token|access[_-]?token)$/i
function redactUrl(url: string): string {
  try {
    const u = new URL(url)
    const params = u.searchParams
    const keys = Array.from(params.keys())
    for (const k of keys) {
      if (REDACTED_PARAMS.test(k)) params.set(k, 'REDACTED')
    }
    u.search = params.toString() ? `?${params.toString()}` : ''
    return u.toString()
  } catch {
    // If URL parsing fails, fall back to a coarse regex scrub.
    return url.replace(/([?&](?:key|api[_-]?key|token|access[_-]?token)=)[^&]*/gi, '$1REDACTED')
  }
}

// Thin wrapper over electron.net.request that sends + receives JSON.
// Provider adapters use this so they don't each reinvent the chunking boilerplate.
export async function httpJson<T = unknown>(opts: HttpJsonRequest): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(opts.headers ?? {})
    }
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json'

    const req = net.request({ method: opts.method ?? 'POST', url: opts.url })
    for (const [k, v] of Object.entries(headers)) req.setHeader(k, v)

    const chunks: Buffer[] = []
    req.on('response', (res) => {
      res.on('data', (chunk) => {
        chunks.push(chunk as Buffer)
      })
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        const status = res.statusCode ?? 0
        const safeUrl = redactUrl(opts.url)
        if (status >= 200 && status < 300) {
          try {
            resolve(text.length > 0 ? (JSON.parse(text) as T) : ({} as T))
          } catch (err) {
            reject(new Error(`Bad JSON from ${safeUrl}: ${(err as Error).message}`))
          }
        } else {
          // Bodies sometimes echo Authorization headers under 4xx; redact
          // before composing the error string.
          reject(new Error(`HTTP ${status} from ${safeUrl}: ${redactSecrets(text.slice(0, 400))}`))
        }
      })
      res.on('error', reject)
    })
    req.on('error', reject)

    if (opts.signal) {
      if (opts.signal.aborted) {
        req.abort()
        reject(new Error('Aborted'))
        return
      }
      opts.signal.addEventListener(
        'abort',
        () => {
          req.abort()
          reject(new Error('Aborted'))
        },
        { once: true }
      )
    }

    if (opts.body !== undefined) req.write(JSON.stringify(opts.body))
    req.end()
  })
}
