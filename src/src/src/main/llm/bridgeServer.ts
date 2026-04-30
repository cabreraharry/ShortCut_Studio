import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http'
import { randomBytes } from 'node:crypto'
import { complete } from './completion'
import { recordError } from '../diagnostics/errorStore'
import type { LlmCompleteRequest } from '@shared/types'

/**
 * Loopback HTTP bridge that lets SCL_Demo's Python workers call into the
 * user's configured LLM via Electron's `complete()` dispatcher. Workers no
 * longer hold provider API keys themselves — they POST a chat-completion
 * request to this bridge over `127.0.0.1`, and Electron resolves the active
 * provider, looks up the key from `loc_adm.db`, calls the provider, and
 * returns the result.
 *
 * The bridge binds to `127.0.0.1` only — never reachable from outside the
 * machine. The supervisor passes the chosen port to spawned worker processes
 * via `ELECTRON_LLM_BRIDGE_PORT`. A constant default (45123) is used so the
 * Python helper has a fallback for dev runs that don't go through the
 * supervisor (e.g. `python -m topics.process_data_Gemini`).
 *
 * Endpoints:
 *   GET  /health            → `{ ok: true }`. Cheap liveness check (no auth).
 *   POST /llm/complete      → wraps `complete()`. Body matches LlmCompleteRequest.
 *                             Requires `X-SCS-Bridge-Token` header.
 *
 * Auth: a 32-byte hex token is generated at server startup and shared with
 * spawned workers via the ELECTRON_LLM_BRIDGE_TOKEN env var. Localhost binding
 * gates network reachability; the header gates which local processes can
 * actually drive completions on the user's keys. Token is per-launch (not
 * persisted), so a leak is invalidated by an app restart.
 */

export const LLM_BRIDGE_PORT = 45123
export const LLM_BRIDGE_TOKEN_HEADER = 'x-scs-bridge-token'

let server: Server | null = null
let bridgeToken: string | null = null

export function getBridgeToken(): string {
  if (!bridgeToken) {
    bridgeToken = randomBytes(32).toString('hex')
  }
  return bridgeToken
}

// 1 MiB. Topic-naming bodies are <2 KB in practice; the cap is a
// defense-in-depth against a misbehaving local process flooding the main
// process with a giant payload before we can JSON.parse it. Loopback-only
// binding limits the attacker set to processes already on this machine,
// but doesn't reduce it to zero.
const MAX_BODY_BYTES = 1024 * 1024

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buf = chunk as Buffer
    total += buf.length
    if (total > MAX_BODY_BYTES) {
      throw new Error(`Request body exceeds ${MAX_BODY_BYTES} bytes`)
    }
    chunks.push(buf)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

export async function startLlmBridgeServer(): Promise<void> {
  if (server) return
  const newServer = createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/health') {
        sendJson(res, 200, { ok: true })
        return
      }
      if (req.method === 'POST' && req.url === '/llm/complete') {
        // Auth — the worker reads the token from ELECTRON_LLM_BRIDGE_TOKEN
        // and sends it in this header. Constant-time-ish compare via
        // string equality is fine here: the token is 64 hex chars (256 bits)
        // and an attacker on this machine can already read SQLite directly.
        const provided = req.headers[LLM_BRIDGE_TOKEN_HEADER]
        if (typeof provided !== 'string' || provided !== getBridgeToken()) {
          sendJson(res, 401, { ok: false, error: 'unauthorized' })
          return
        }
        const body = await readBody(req)
        let parsed: LlmCompleteRequest
        try {
          parsed = JSON.parse(body) as LlmCompleteRequest
        } catch (err) {
          sendJson(res, 400, {
            ok: false,
            error: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`
          })
          return
        }
        const result = await complete(parsed)
        // Mirror the dispatcher's contract: ok=false is a normal in-band
        // result, not a 500. Workers can branch on it directly.
        sendJson(res, 200, result)
        return
      }
      sendJson(res, 404, { ok: false, error: 'Not found' })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      recordError({
        source: 'llm',
        severity: 'error',
        category: 'bridge',
        message,
        stack: err instanceof Error ? err.stack : undefined,
        context: { url: req.url ?? null, method: req.method ?? null }
      })
      sendJson(res, 500, { ok: false, error: message })
    }
  })
  // Wait for the listen callback before resolving — supervisor spawns
  // workers immediately after this returns, and any worker that calls the
  // bridge before bind() completes would get ECONNREFUSED.
  await new Promise<void>((resolve, reject) => {
    newServer.once('error', reject)
    newServer.listen(LLM_BRIDGE_PORT, '127.0.0.1', () => {
      newServer.off('error', reject)
      // eslint-disable-next-line no-console
      console.log(`[llm-bridge] listening on 127.0.0.1:${LLM_BRIDGE_PORT}`)
      resolve()
    })
  })
  server = newServer
}

export function stopLlmBridgeServer(): void {
  if (server) {
    server.close()
    server = null
  }
}
