import type {
  ExecEngineConfig,
  ExecEngineConnectionState,
  ExecEngineConnectionStatus,
  ExecEngineSession,
  ExecEngineSignInRequest,
  ExecEngineSignInResult
} from '@shared/types'
import { getLocAdmDb } from '../db/connection'
import { recordError } from '../diagnostics/errorStore'
// Renamed import — this file already has a local `notify` for status broadcasts.
import { notify as notifyUser } from '../notifications/dispatch'
import { sisHealthCheck, sisSignIn, sisSignOut, sisVerifyToken } from './sisAuth'

/**
 * Manages the ExecEngine SIS session: load persisted token on boot, sign in
 * / out, run periodic /health checks, surface a unified connection-status
 * snapshot to the renderer (and the IExecEngineClient factory).
 *
 * Tokens persist to AdminData so reconnect across restarts is automatic.
 * Username/password are NEVER stored — the user re-enters them via a dialog
 * when the token expires.
 */

interface AdminDbRow {
  ExecEngineSisHost: string
  ExecEngineSisPort: number
  ExecEngineSessionToken: string | null
  ExecEngineCpId: string | null
  ExecEngineMasterId: string | null
  ExecEngineTokenExpiresAt: number | null
}

let cachedStatus: ExecEngineConnectionStatus | null = null
let listeners: Array<(s: ExecEngineConnectionStatus) => void> = []

function readAdminRow(): AdminDbRow {
  const row = getLocAdmDb()
    .prepare(
      `SELECT ExecEngineSisHost, ExecEngineSisPort, ExecEngineSessionToken,
              ExecEngineCpId, ExecEngineMasterId, ExecEngineTokenExpiresAt
       FROM AdminData WHERE RecID = 1`
    )
    .get() as AdminDbRow | undefined
  if (!row) {
    return {
      ExecEngineSisHost: 'localhost',
      ExecEngineSisPort: 44450,
      ExecEngineSessionToken: null,
      ExecEngineCpId: null,
      ExecEngineMasterId: null,
      ExecEngineTokenExpiresAt: null
    }
  }
  return row
}

function persistConfig(config: ExecEngineConfig): void {
  getLocAdmDb()
    .prepare(
      'UPDATE AdminData SET ExecEngineSisHost = ?, ExecEngineSisPort = ? WHERE RecID = 1'
    )
    .run(config.sisHost, config.sisPort)
}

/**
 * Persist a session and its token together. Both are passed explicitly so the
 * function never silently reads from `memoryToken` — that would couple
 * persistence correctness to caller ordering, which the previous version did
 * implicitly.
 */
function persistSession(token: string | null, session: ExecEngineSession | null): void {
  getLocAdmDb()
    .prepare(
      `UPDATE AdminData SET
         ExecEngineSessionToken = ?,
         ExecEngineCpId = ?,
         ExecEngineMasterId = ?,
         ExecEngineTokenExpiresAt = ?
       WHERE RecID = 1`
    )
    .run(
      token,
      session?.cpId ?? null,
      session?.masterId ?? null,
      session?.expiresAt ?? null
    )
}

/**
 * The session token itself is held in module-scope memory for the duration of
 * the app run; we mirror it to AdminData so a restart can recover the live
 * session. Reads happen via this internal helper; the public API never
 * surfaces the raw token to the renderer (security in depth — even the
 * renderer-side `ExecEngineSession` type omits it).
 */
let memoryToken: string | null = null
function readSessionToken(): string | null {
  return memoryToken
}
function setSessionToken(token: string | null): void {
  memoryToken = token
}

function buildStatus(
  state: ExecEngineConnectionState,
  config: ExecEngineConfig,
  session: ExecEngineSession | null,
  extras?: Partial<ExecEngineConnectionStatus>
): ExecEngineConnectionStatus {
  return {
    state,
    config,
    session: session ?? undefined,
    ...extras
  }
}

function notify(status: ExecEngineConnectionStatus): void {
  cachedStatus = status
  for (const cb of listeners) {
    try {
      cb(status)
    } catch {
      // listener errors should never break state propagation
    }
  }
}

/**
 * Subscribe to connection-state changes. Used by the IPC handler to push
 * status updates to the renderer; also used by the IExecEngineClient factory
 * to invalidate its cached client when state flips.
 */
export function onConnectionChange(cb: (s: ExecEngineConnectionStatus) => void): () => void {
  listeners.push(cb)
  return () => {
    listeners = listeners.filter((x) => x !== cb)
  }
}

/**
 * Initialize the auth state manager. Reads persisted config + token from
 * AdminData. If a token exists and isn't expired, we trust it pending the
 * next /health check. If expired, transition to 'expired'.
 *
 * Doesn't perform any network I/O — call `runHealthCheck()` separately to
 * probe SIS reachability.
 */
export function initAuthState(): void {
  const row = readAdminRow()
  const config: ExecEngineConfig = {
    sisHost: row.ExecEngineSisHost,
    sisPort: row.ExecEngineSisPort
  }

  if (
    row.ExecEngineSessionToken &&
    row.ExecEngineCpId &&
    row.ExecEngineMasterId &&
    row.ExecEngineTokenExpiresAt
  ) {
    setSessionToken(row.ExecEngineSessionToken)
    const session: ExecEngineSession = {
      cpId: row.ExecEngineCpId,
      masterId: row.ExecEngineMasterId,
      expiresAt: row.ExecEngineTokenExpiresAt,
      issuedAt: 0  // not persisted; would need an extra column
    }
    const nowSec = Math.floor(Date.now() / 1000)
    // Optimistic 'connected' if the persisted token hasn't expired locally.
    // `verifyPersistedToken()` in main/index.ts boots a fire-and-forget call
    // to SIS to confirm; if SIS rejects, we transition to 'expired'. While
    // verify is in flight, the client is functionally local-only because
    // RealExecEngineClient currently delegates every data method to
    // RealLocalExecEngineClient — so a brief mis-classification has no
    // observable effect today. When Queue-TCP transport lands, this race
    // window will need to gate Queue calls on a 'verified' substate (or
    // pre-await verification before exposing the status).
    const state: ExecEngineConnectionState =
      session.expiresAt > nowSec ? 'connected' : 'expired'
    notify(buildStatus(state, config, session))
    return
  }

  // No persisted token — but if the user has changed the host/port from the
  // defaults, treat that as 'disconnected' (configured, just not signed in).
  const state: ExecEngineConnectionState =
    config.sisHost === 'localhost' && config.sisPort === 44450
      ? 'not-configured'
      : 'disconnected'
  notify(buildStatus(state, config, null))
}

export function getStatus(): ExecEngineConnectionStatus {
  if (!cachedStatus) initAuthState()
  return cachedStatus!
}

export function isConnected(): boolean {
  return getStatus().state === 'connected'
}

export function setConfig(next: ExecEngineConfig): ExecEngineConnectionStatus {
  persistConfig(next)
  const status = getStatus()
  // Changing the host/port invalidates any existing session (it was issued by
  // a different SIS).
  if (status.session) {
    setSessionToken(null)
    persistSession(null, null)
  }
  notify(
    buildStatus(
      'disconnected',
      next,
      null,
      { healthOk: undefined, healthLatencyMs: undefined }
    )
  )
  return getStatus()
}

// Single-flight guard: a user double-clicking the Sign-in button (or two IPC
// callers arriving at once) shouldn't fire two parallel SIS signins. The
// function is async so JS event-loop reentrancy is real even though Node is
// single-threaded.
let signInInFlight = false

export async function signIn(req: ExecEngineSignInRequest): Promise<ExecEngineSignInResult> {
  const status = getStatus()
  if (signInInFlight) {
    return {
      ok: false,
      status,
      message: 'Sign-in already in progress'
    }
  }
  signInInFlight = true
  notify(buildStatus('connecting', status.config, null))
  try {
    const resp = await sisSignIn({
      host: status.config.sisHost,
      port: status.config.sisPort,
      username: req.username,
      password: req.password,
      cpId: req.cpId
    })

    if (!resp.success || !resp.session_token || !resp.cp_id || !resp.master_id || !resp.expires_at) {
      const lastError = resp.message || 'SIS rejected the signin'
      // Username deliberately omitted — PII shouldn't land in a debug log.
      recordError({
        source: 'execengine',
        severity: 'error',
        category: 'sis-signin',
        message: lastError,
        context: { sisHost: status.config.sisHost, sisPort: status.config.sisPort }
      })
      notifyUser({
        severity: 'error',
        source: 'execengine',
        title: 'Peer sign-in failed',
        body: lastError,
        action: { kind: 'navigate', target: '/settings#execengine' }
      })
      const next = buildStatus(
        'error',
        status.config,
        null,
        { lastError }
      )
      notify(next)
      return { ok: false, status: next, message: resp.message }
    }

    setSessionToken(resp.session_token)
    const session: ExecEngineSession = {
      cpId: resp.cp_id,
      masterId: resp.master_id,
      expiresAt: resp.expires_at,
      issuedAt: Math.floor(Date.now() / 1000)
    }
    persistSession(resp.session_token, session)
    const next = buildStatus('connected', status.config, session, { lastError: undefined })
    notify(next)
    return { ok: true, status: next, message: resp.message }
  } catch (err) {
    const lastError = err instanceof Error ? err.message : String(err)
    // Username deliberately omitted — PII shouldn't land in a debug log.
    recordError({
      source: 'execengine',
      severity: 'error',
      category: 'sis-signin',
      message: lastError,
      stack: err instanceof Error ? err.stack : undefined,
      context: { sisHost: status.config.sisHost, sisPort: status.config.sisPort }
    })
    notifyUser({
      severity: 'error',
      source: 'execengine',
      title: 'Peer sign-in failed',
      body: lastError,
      action: { kind: 'navigate', target: '/settings#execengine' }
    })
    const next = buildStatus(
      'error',
      status.config,
      null,
      { lastError }
    )
    notify(next)
    return { ok: false, status: next }
  } finally {
    signInInFlight = false
  }
}

export async function signOut(): Promise<ExecEngineConnectionStatus> {
  const status = getStatus()
  const token = readSessionToken()
  if (token && status.session) {
    try {
      await sisSignOut({
        host: status.config.sisHost,
        port: status.config.sisPort,
        sessionToken: token,
        cpId: status.session.cpId
      })
    } catch (err) {
      // SIS unreachable / signout failed — drop our local state anyway. The
      // session token will eventually expire server-side. Logged at 'warning'
      // because the user-visible action (sign out locally) still succeeds.
      recordError({
        source: 'execengine',
        severity: 'warning',
        category: 'sis-signout',
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        context: { sisHost: status.config.sisHost, sisPort: status.config.sisPort }
      })
    }
  }
  setSessionToken(null)
  persistSession(null, null)
  const next = buildStatus('disconnected', status.config, null)
  notify(next)
  return next
}

/**
 * Probe SIS /health. Updates the status's `healthOk` + `healthLatencyMs` but
 * doesn't change the connection state — health is independent of auth.
 *
 * No TTL / throttle: callers (the Diagnostics panel) gate via React Query's
 * `isPending` flag. SIS rate-limiting (if any) is the backend's concern.
 */
export async function runHealthCheck(): Promise<ExecEngineConnectionStatus> {
  const status = getStatus()
  const result = await sisHealthCheck({
    host: status.config.sisHost,
    port: status.config.sisPort
  })
  if (!result.ok && result.error) {
    recordError({
      source: 'execengine',
      severity: 'warning',
      category: 'sis-health',
      message: result.error,
      context: { sisHost: status.config.sisHost, sisPort: status.config.sisPort, latencyMs: result.latencyMs }
    })
  }
  const next = buildStatus(status.state, status.config, status.session ?? null, {
    healthOk: result.ok,
    healthLatencyMs: result.latencyMs,
    lastError: result.error ?? status.lastError
  })
  notify(next)
  return next
}

/**
 * Verify the persisted token is still valid against SIS. Called once on boot
 * after `initAuthState` if a session was loaded from disk. Transitions
 * 'connected' → 'expired' if SIS rejects the token.
 */
export async function verifyPersistedToken(): Promise<void> {
  const status = getStatus()
  const token = readSessionToken()
  if (status.state !== 'connected' || !token) return
  try {
    const resp = await sisVerifyToken({
      host: status.config.sisHost,
      port: status.config.sisPort,
      sessionToken: token
    })
    if (!resp.valid) {
      const lastError = resp.message || 'Token rejected by SIS'
      recordError({
        source: 'execengine',
        severity: 'warning',
        category: 'sis-verify',
        message: lastError,
        context: { sisHost: status.config.sisHost, sisPort: status.config.sisPort }
      })
      setSessionToken(null)
      persistSession(null, null)
      notify(
        buildStatus('expired', status.config, null, {
          lastError
        })
      )
    }
  } catch {
    // Network / SIS down — keep the 'connected' state optimistically; the
    // next signin attempt or health check will reconcile. Not logged: a
    // transient network blip on boot is noise, not an error.
  }
}

/**
 * Read the live session token. Used by future Queue-protocol code that
 * authenticates outbound TCP connections. The renderer never sees this.
 */
export function getSessionTokenForBackend(): string | null {
  return readSessionToken()
}
