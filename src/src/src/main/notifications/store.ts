import { getErrorsDb } from '../db/errorsConnection'
import { redactString } from '../diagnostics/errorStore'
import type {
  AppNotification,
  NotificationAction,
  NotificationListQuery,
  NotificationListResult,
  NotificationSeverity,
  NotificationSource
} from '@shared/types'

/**
 * User-facing notifications store. Distinct surface from AppErrors:
 * AppErrors is the diagnostic ledger (every IPC throw / worker stderr),
 * Notifications is curated user-visible events (the bell drawer + OS toasts).
 *
 * Hard contract: insert() MUST NOT throw. The dispatch layer must never
 * crash the thing it observes.
 */

const ROW_CAP = 500
const TRIM_PROBABILITY = 0.01
const TITLE_CAP_BYTES = 200
const BODY_CAP_BYTES = 800

export interface InsertInput {
  severity: NotificationSeverity
  source: NotificationSource
  title: string
  body?: string | null
  action?: NotificationAction | null
}

function truncate(s: string, capBytes: number): string {
  if (s.length <= capBytes) return s
  return s.slice(0, capBytes - 14) + '… [truncated]'
}

export function insert(input: InsertInput): AppNotification | null {
  try {
    const db = getErrorsDb()
    const ts = Date.now()
    const title = truncate(redactString(input.title ?? ''), TITLE_CAP_BYTES)
    const body = input.body
      ? truncate(redactString(input.body), BODY_CAP_BYTES)
      : null
    const actionJson = input.action ? JSON.stringify(input.action) : null

    const result = db
      .prepare(
        `INSERT INTO Notifications (ts, severity, source, title, body, action)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(ts, input.severity, input.source, title, body, actionJson)

    if (Math.random() < TRIM_PROBABILITY) trimToCap()

    return {
      id: Number(result.lastInsertRowid),
      ts,
      severity: input.severity,
      source: input.source,
      title,
      body,
      action: input.action ?? null,
      readAt: null,
      dismissedAt: null
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[notifications] failed to insert', err)
    return null
  }
}

function trimToCap(): void {
  try {
    const db = getErrorsDb()
    db.prepare(
      `DELETE FROM Notifications WHERE id NOT IN (
         SELECT id FROM Notifications ORDER BY id DESC LIMIT ?
       )`
    ).run(ROW_CAP)
  } catch {
    /* swallow */
  }
}

interface NotificationRow {
  id: number
  ts: number
  severity: string
  source: string
  title: string
  body: string | null
  action: string | null
  readAt: number | null
  dismissedAt: number | null
}

function rowToNotification(r: NotificationRow): AppNotification {
  let action: NotificationAction | null = null
  if (r.action) {
    try {
      action = JSON.parse(r.action) as NotificationAction
    } catch {
      action = null
    }
  }
  return {
    id: r.id,
    ts: r.ts,
    severity: r.severity as NotificationSeverity,
    source: r.source as NotificationSource,
    title: r.title,
    body: r.body,
    action,
    readAt: r.readAt,
    dismissedAt: r.dismissedAt
  }
}

export function list(query: NotificationListQuery = {}): NotificationListResult {
  const db = getErrorsDb()
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 200)
  const offset = Math.max(query.offset ?? 0, 0)

  const where: string[] = []
  if (query.unreadOnly) where.push('readAt IS NULL')
  if (!query.includeDismissed) where.push('dismissedAt IS NULL')
  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

  const rows = db
    .prepare(
      `SELECT id, ts, severity, source, title, body, action, readAt, dismissedAt
       FROM Notifications
       ${whereSql}
       ORDER BY ts DESC, id DESC
       LIMIT ? OFFSET ?`
    )
    .all(limit, offset) as NotificationRow[]

  const totalRow = db
    .prepare(`SELECT COUNT(*) AS c FROM Notifications ${whereSql}`)
    .get() as { c: number }

  const unreadRow = db
    .prepare(
      'SELECT COUNT(*) AS c FROM Notifications WHERE readAt IS NULL AND dismissedAt IS NULL'
    )
    .get() as { c: number }

  return {
    rows: rows.map(rowToNotification),
    total: totalRow.c,
    unreadCount: unreadRow.c
  }
}

export function getUnreadCount(): number {
  try {
    const db = getErrorsDb()
    const row = db
      .prepare(
        'SELECT COUNT(*) AS c FROM Notifications WHERE readAt IS NULL AND dismissedAt IS NULL'
      )
      .get() as { c: number }
    return row.c
  } catch {
    return 0
  }
}

export function markRead(target: number | 'all'): void {
  const db = getErrorsDb()
  const now = Date.now()
  if (target === 'all') {
    db.prepare('UPDATE Notifications SET readAt = ? WHERE readAt IS NULL').run(now)
  } else {
    db.prepare('UPDATE Notifications SET readAt = ? WHERE id = ?').run(now, target)
  }
}

export function dismiss(target: number | 'all'): { dismissed: number } {
  const db = getErrorsDb()
  const now = Date.now()
  if (target === 'all') {
    const r = db
      .prepare('UPDATE Notifications SET dismissedAt = ? WHERE dismissedAt IS NULL')
      .run(now)
    return { dismissed: r.changes }
  }
  const r = db
    .prepare('UPDATE Notifications SET dismissedAt = ? WHERE id = ?')
    .run(now, target)
  return { dismissed: r.changes }
}
