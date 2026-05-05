import { net } from 'electron'
import { redactSecrets } from '../../security/redact'

export interface HttpJsonRequest {
  url: string
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: unknown
  signal?: AbortSignal
  // Hard wall-clock timeout. Defaults to 60 s — long enough for slow chat
  // completions on a busy provider, short enough that a hung TCP socket
  // doesn't pin a worker / IPC promise indefinitely. Callers that need a
  // tighter or looser bound can override.
  timeoutMs?: number
  // Cap on total response-body bytes received before we abort the
  // connection. Defaults to 16 MiB — comfortably above the largest
  // plausible chat-completion response, well below the threshold where a
  // malicious / compromised provider could OOM the main process by
  // streaming garbage. Per-call-site overrides recommended for endpoints
  // with smaller expected payloads (model lists, usage queries).
  maxBytes?: number
}

const DEFAULT_TIMEOUT_MS = 60_000
const DEFAULT_MAX_BYTES = 16 * 1024 * 1024

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

    const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const safeUrl = redactUrl(opts.url)

    // Single-shot settle so timeout, body-cap, and stream events can't
    // double-resolve the promise even if the underlying request fires
    // both 'error' and 'response/end' (rare but observed under abort).
    let settled = false
    const settle = (fn: () => void): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fn()
    }

    const timer = setTimeout(() => {
      try {
        req.abort()
      } catch {
        /* abort after settle: harmless */
      }
      settle(() => reject(new Error(`Request timed out after ${timeoutMs}ms: ${safeUrl}`)))
    }, timeoutMs)

    let received = 0
    const chunks: Buffer[] = []
    req.on('response', (res) => {
      // Reject upfront on a too-large Content-Length rather than reading any
      // bytes. Some servers omit it (chunked transfer); the per-chunk check
      // below catches those.
      const declared = Number(res.headers['content-length'])
      if (Number.isFinite(declared) && declared > maxBytes) {
        try {
          req.abort()
        } catch {
          /* harmless */
        }
        settle(() =>
          reject(
            new Error(
              `Response too large (${declared} bytes, cap ${maxBytes}): ${safeUrl}`
            )
          )
        )
        return
      }

      res.on('data', (chunk) => {
        if (settled) return
        const buf = chunk as Buffer
        received += buf.length
        if (received > maxBytes) {
          try {
            req.abort()
          } catch {
            /* harmless */
          }
          settle(() =>
            reject(
              new Error(
                `Response exceeded ${maxBytes} bytes mid-stream: ${safeUrl}`
              )
            )
          )
          return
        }
        chunks.push(buf)
      })
      res.on('end', () => {
        if (settled) return
        const text = Buffer.concat(chunks).toString('utf8')
        const status = res.statusCode ?? 0
        if (status >= 200 && status < 300) {
          try {
            settle(() => resolve(text.length > 0 ? (JSON.parse(text) as T) : ({} as T)))
          } catch (err) {
            settle(() =>
              reject(new Error(`Bad JSON from ${safeUrl}: ${(err as Error).message}`))
            )
          }
        } else {
          // Bodies sometimes echo Authorization headers under 4xx; redact
          // before composing the error string.
          settle(() =>
            reject(
              new Error(`HTTP ${status} from ${safeUrl}: ${redactSecrets(text.slice(0, 400))}`)
            )
          )
        }
      })
      res.on('error', (err) => settle(() => reject(err)))
    })
    req.on('error', (err) => settle(() => reject(err)))

    if (opts.signal) {
      if (opts.signal.aborted) {
        try {
          req.abort()
        } catch {
          /* harmless */
        }
        settle(() => reject(new Error('Aborted')))
        return
      }
      opts.signal.addEventListener(
        'abort',
        () => {
          try {
            req.abort()
          } catch {
            /* harmless */
          }
          settle(() => reject(new Error('Aborted')))
        },
        { once: true }
      )
    }

    if (opts.body !== undefined) req.write(JSON.stringify(opts.body))
    req.end()
  })
}
