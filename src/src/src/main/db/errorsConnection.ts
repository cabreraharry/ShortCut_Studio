import Database from 'better-sqlite3'
import { app } from 'electron'
import { join, dirname } from 'node:path'
import { mkdirSync } from 'node:fs'

let errorsDb: Database.Database | null = null

/**
 * Resolve the path to errors.db. Same dev/prod split as loc_adm.db, but with
 * NO bundled seed — errors.db is purely a runtime capture store, so the
 * `CREATE TABLE IF NOT EXISTS` migration creates it on first boot.
 *
 * Kept separate from loc_adm.db on purpose:
 *   - Privacy: a future "send debug bundle to support" flow can ship just
 *     errors.db without leaking API keys / paths from AdminData / LLM_Provider.
 *   - Corruption isolation: a wedged loc_adm.db doesn't take the error log
 *     down with it — the error log is what you need most when something's wrong.
 *   - Tunable durability: errors run with synchronous=NORMAL (fast, OK to lose
 *     the last few rows on crash), while loc_adm stays at FULL for config
 *     integrity. Different connections allow different PRAGMAs.
 *   - Drop-without-fear: "reset error history" = delete the file.
 */
function errorsDbPath(): string {
  if (app.isPackaged) {
    return join(app.getPath('userData'), 'db_files', 'errors.db')
  }
  return join(__dirname, '../../db_files/errors.db')
}

export function initErrorsDb(): Database.Database {
  if (errorsDb) return errorsDb
  const path = errorsDbPath()
  mkdirSync(dirname(path), { recursive: true })
  errorsDb = new Database(path)
  errorsDb.pragma('journal_mode = WAL')
  // Errors are debug data. Losing the last few rows on hard crash is fine;
  // gain is faster writes since recordError() runs on every IPC throw and
  // every worker stderr line.
  errorsDb.pragma('synchronous = NORMAL')
  runErrorsMigrations(errorsDb)
  return errorsDb
}

export function getErrorsDb(): Database.Database {
  if (!errorsDb) return initErrorsDb()
  return errorsDb
}

export function closeErrorsDb(): void {
  if (errorsDb) {
    errorsDb.close()
    errorsDb = null
  }
}

/**
 * Idempotent schema for errors.db. Single table + two indexes; small enough
 * to inline rather than split into a separate migrations module.
 */
function runErrorsMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS AppErrors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      source TEXT NOT NULL,
      severity TEXT NOT NULL,
      category TEXT,
      message TEXT NOT NULL,
      stack TEXT,
      context TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_AppErrors_ts ON AppErrors(ts DESC);
    CREATE INDEX IF NOT EXISTS idx_AppErrors_source ON AppErrors(source, ts DESC);
  `)
}
