import { getErrorsDb } from '../db/errorsConnection'
import type {
  AppError,
  AppErrorSeverity,
  AppErrorSource,
  ErrorListQuery,
  ErrorListResult
} from '@shared/types'

/**
 * App-wide errors store. The single queryable surface for IPC throws,
 * LLM/ExecEngine failures, worker crashes, and renderer uncaught exceptions.
 *
 * Hard contract: `recordError()` MUST NOT throw. The diagnostics layer
 * cannot be allowed to crash the thing it's observing.
 */

const ROW_CAP = 10_000
const TRIM_PROBABILITY = 0.01
const MESSAGE_CAP_BYTES = 4 * 1024
const STACK_CAP_BYTES = 4 * 1024
const CONTEXT_CAP_BYTES = 8 * 1024

const SECRET_HEADER_KEYS = new Set([
  'authorization',
  'x-api-key',
  'apikey',
  'api_key',
  'apiKey',
  'password',
  'token',
  'sessiontoken',
  'session_token'
])

const SECRET_PATTERNS: RegExp[] = [
  /sk-ant-api[0-9]{2}-[A-Za-z0-9_-]{90,}/g,
  /sk-[A-Za-z0-9_-]{20,}/g,
  /AIza[0-9A-Za-z_-]{35}/g
]

export interface RecordErrorInput {
  source: AppErrorSource
  severity: AppErrorSeverity
  category?: string | null
  message: string
  stack?: string | null
  context?: unknown
}

export function redactString(s: string): string {
  let out = s
  for (const re of SECRET_PATTERNS) out = out.replace(re, '[REDACTED]')
  return out
}

function truncate(s: string, capBytes: number): string {
  if (s.length <= capBytes) return s
  return s.slice(0, capBytes - 14) + '… [truncated]'
}

// Total-node budget caps the worst case for adversarial / accidental
// nested structures. Without it, an array of arrays of arrays of length
// 20 each could fan out to 20^4 = 160k visits before depth caps. With it,
// we hard-stop at 1k visits regardless of shape.
const REDACT_MAX_NODES = 1_000
const REDACT_MAX_DEPTH = 4
const REDACT_MAX_ARRAY = 20

function redactValue(value: unknown, depth: number, budget: { n: number }): unknown {
  if (budget.n <= 0) return '[budget-cap]'
  budget.n -= 1
  if (depth > REDACT_MAX_DEPTH) return '[depth-cap]'
  if (value == null) return value
  if (typeof value === 'string') return redactString(value)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) {
    return value
      .slice(0, REDACT_MAX_ARRAY)
      .map((v) => redactValue(v, depth + 1, budget))
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as object)) {
      if (SECRET_HEADER_KEYS.has(k.toLowerCase())) {
        out[k] = '[REDACTED]'
      } else {
        out[k] = redactValue(v, depth + 1, budget)
      }
    }
    return out
  }
  return String(value)
}

export function redactArgs(args: unknown[]): unknown[] {
  const budget = { n: REDACT_MAX_NODES }
  return args.map((a) => redactValue(a, 0, budget))
}

function serializeContext(ctx: unknown): string | null {
  if (ctx == null) return null
  try {
    const redacted = redactValue(ctx, 0, { n: REDACT_MAX_NODES })
    const json = JSON.stringify(redacted)
    return truncate(json, CONTEXT_CAP_BYTES)
  } catch {
    return null
  }
}

export function recordError(input: RecordErrorInput): void {
  try {
    const db = getErrorsDb()
    const message = truncate(redactString(input.message ?? ''), MESSAGE_CAP_BYTES)
    const stack = input.stack
      ? truncate(redactString(input.stack), STACK_CAP_BYTES)
      : null
    const context = serializeContext(input.context)

    db.prepare(
      `INSERT INTO AppErrors (ts, source, severity, category, message, stack, context)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      Date.now(),
      input.source,
      input.severity,
      input.category ?? null,
      message,
      stack,
      context
    )

    if (Math.random() < TRIM_PROBABILITY) trimToCap()
  } catch (err) {
    // Backstop: logging must never crash the thing it observes.
    // eslint-disable-next-line no-console
    console.error('[errorStore] failed to record', err)
  }
}

function trimToCap(): void {
  try {
    const db = getErrorsDb()
    db.prepare(
      `DELETE FROM AppErrors WHERE id NOT IN (
         SELECT id FROM AppErrors ORDER BY id DESC LIMIT ?
       )`
    ).run(ROW_CAP)
  } catch {
    /* swallow */
  }
}

interface AppErrorRow {
  id: number
  ts: number
  source: string
  severity: string
  category: string | null
  message: string
  stack: string | null
  context: string | null
}

export function listErrors(query: ErrorListQuery = {}): ErrorListResult {
  const db = getErrorsDb()
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 200)
  const offset = Math.max(query.offset ?? 0, 0)

  const where: string[] = []
  const params: unknown[] = []

  if (query.source) {
    const sources = Array.isArray(query.source) ? query.source : [query.source]
    if (sources.length > 0) {
      where.push(`source IN (${sources.map(() => '?').join(',')})`)
      params.push(...sources)
    }
  }
  if (query.severity) {
    where.push('severity = ?')
    params.push(query.severity)
  }
  if (typeof query.sinceTs === 'number') {
    where.push('ts >= ?')
    params.push(query.sinceTs)
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

  const rows = db
    .prepare(
      `SELECT id, ts, source, severity, category, message, stack, context
       FROM AppErrors
       ${whereSql}
       ORDER BY ts DESC, id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as AppErrorRow[]

  const totalRow = db
    .prepare(`SELECT COUNT(*) AS c FROM AppErrors ${whereSql}`)
    .get(...params) as { c: number }

  return {
    rows: rows.map(rowToAppError),
    total: totalRow.c
  }
}

function rowToAppError(r: AppErrorRow): AppError {
  return {
    id: r.id,
    ts: r.ts,
    source: r.source as AppErrorSource,
    severity: r.severity as AppErrorSeverity,
    category: r.category,
    message: r.message,
    stack: r.stack,
    context: r.context
  }
}

export function clearAllErrors(): { deleted: number } {
  const db = getErrorsDb()
  const result = db.prepare('DELETE FROM AppErrors').run()
  return { deleted: result.changes }
}
