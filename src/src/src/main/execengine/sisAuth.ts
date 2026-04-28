import { net } from 'electron'

/**
 * Minimal HTTP client for ExecEngine V2's SIS (Sign-In Service).
 *
 * Endpoints (per `D:/ExecEngine/V2/server_V2/sis_V2/sis_fastapi_models.py`):
 *  - POST /api/v1/auth/signin  → CPAuthenticationResponse
 *  - POST /api/v1/auth/signout → CPSignOutResponse
 *  - POST /api/v1/auth/verify  → CPTokenVerificationResponse
 *  - GET  /api/v1/health       → HealthCheckResponse
 *
 * Tokens issued by SIS are SHA256 strings with 24-hour validity. There is no
 * mTLS, no refresh-token; callers re-signin when expiresAt passes.
 *
 * We use `electron.net.request` directly here (not the providers/httpJson
 * wrapper) because we need precise control over status codes — a 401 from
 * /signin must surface differently from a 5xx, and httpJson collapses both
 * into a generic Error.
 */

const TIMEOUT_MS = 10_000

export interface SisAuthenticationResponse {
  success: boolean
  session_token?: string
  cp_id?: string
  master_id?: string
  expires_at?: number
  message: string
}

export interface SisSignOutResponse {
  success: boolean
  message: string
}

export interface SisTokenVerificationResponse {
  valid: boolean
  cp_id?: string
  master_id?: string
  expires_at?: number
  message: string
}

export interface SisHealthResponse {
  status: string
  /** Implementation-specific extra fields — we don't depend on them. */
  [key: string]: unknown
}

interface RawResponse {
  status: number
  body: string
}

function baseUrl(host: string, port: number): string {
  // SIS docs default to plain HTTP on a NGINX-fronted port. TLS is configured
  // upstream by the deployment; we treat host:port as opaque.
  return `http://${host}:${port}`
}

/**
 * Low-level HTTP request that returns `{status, body}` without throwing on
 * non-2xx. Caller decides how to interpret each status.
 */
function request(
  method: 'GET' | 'POST',
  url: string,
  body?: unknown
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = net.request({ method, url })
    req.setHeader('Accept', 'application/json')
    if (body !== undefined) req.setHeader('Content-Type', 'application/json')

    const timer = setTimeout(() => {
      req.abort()
      reject(new Error(`Timeout after ${TIMEOUT_MS}ms: ${method} ${url}`))
    }, TIMEOUT_MS)

    const chunks: Buffer[] = []
    req.on('response', (res) => {
      res.on('data', (c) => chunks.push(c as Buffer))
      res.on('end', () => {
        clearTimeout(timer)
        resolve({
          status: res.statusCode ?? 0,
          body: Buffer.concat(chunks).toString('utf8')
        })
      })
      res.on('error', (err) => {
        clearTimeout(timer)
        reject(err)
      })
    })
    req.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })

    if (body !== undefined) req.write(JSON.stringify(body))
    req.end()
  })
}

function parseJson<T>(body: string, label: string): T {
  if (!body) throw new Error(`Empty body from ${label}`)
  try {
    return JSON.parse(body) as T
  } catch (err) {
    throw new Error(
      `Invalid JSON from ${label}: ${(err as Error).message}. Body: ${body.slice(0, 200)}`
    )
  }
}

/**
 * Sign in to SIS. On success the response carries a session token + cp_id +
 * master_id + expires_at. On failure it still parses (success: false) with a
 * human message. Network-level failures throw.
 */
export async function sisSignIn(opts: {
  host: string
  port: number
  username: string
  password: string
  cpId?: string
}): Promise<SisAuthenticationResponse> {
  const url = `${baseUrl(opts.host, opts.port)}/api/v1/auth/signin`
  const r = await request('POST', url, {
    username: opts.username,
    password: opts.password,
    cp_id: opts.cpId
  })
  // SIS returns 200 on both successful and unsuccessful auth (with success:
  // false in the body). 4xx/5xx are network/server problems we should surface.
  if (r.status >= 400) {
    throw new Error(`SIS signin returned HTTP ${r.status}: ${r.body.slice(0, 200)}`)
  }
  return parseJson<SisAuthenticationResponse>(r.body, 'POST /api/v1/auth/signin')
}

export async function sisSignOut(opts: {
  host: string
  port: number
  sessionToken: string
  cpId: string
}): Promise<SisSignOutResponse> {
  const url = `${baseUrl(opts.host, opts.port)}/api/v1/auth/signout`
  const r = await request('POST', url, {
    session_token: opts.sessionToken,
    cp_id: opts.cpId
  })
  if (r.status >= 400) {
    throw new Error(`SIS signout returned HTTP ${r.status}: ${r.body.slice(0, 200)}`)
  }
  return parseJson<SisSignOutResponse>(r.body, 'POST /api/v1/auth/signout')
}

export async function sisVerifyToken(opts: {
  host: string
  port: number
  sessionToken: string
}): Promise<SisTokenVerificationResponse> {
  const url = `${baseUrl(opts.host, opts.port)}/api/v1/auth/verify`
  const r = await request('POST', url, { session_token: opts.sessionToken })
  if (r.status >= 400) {
    throw new Error(`SIS verify returned HTTP ${r.status}: ${r.body.slice(0, 200)}`)
  }
  return parseJson<SisTokenVerificationResponse>(r.body, 'POST /api/v1/auth/verify')
}

/**
 * Check that SIS is reachable. Used both as a precheck before signin and as
 * an ongoing reachability probe surfaced in Diagnostics.
 */
export async function sisHealthCheck(opts: {
  host: string
  port: number
}): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now()
  const url = `${baseUrl(opts.host, opts.port)}/api/v1/health`
  try {
    const r = await request('GET', url)
    const latencyMs = Date.now() - start
    if (r.status >= 200 && r.status < 300) {
      return { ok: true, latencyMs }
    }
    return { ok: false, latencyMs, error: `HTTP ${r.status}` }
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err)
    }
  }
}
