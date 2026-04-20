import Database from 'better-sqlite3'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { getMode } from '../ipc/mode'

/**
 * Read-only accessor for SCL_Demo's per-mode scan databases.
 *
 * SCL_Demo writes scan + topic data into SCLFolder_Publ.db / SCLFolder_Priv.db.
 * The new Electron admin reads them; it never writes (that's the scanner's job).
 *
 * Default location: sibling `SCL_Demo/db_files/` directory. The path can be
 * overridden via env var `SCL_DEMO_DB_DIR` for dev convenience.
 */

const DEFAULT_DB_DIR = 'D:/Client-Side_Project/SCL_Demo/db_files'

function sclDbDir(): string {
  return process.env['SCL_DEMO_DB_DIR'] ?? DEFAULT_DB_DIR
}

function dbFileName(): string {
  return getMode() === 'priv' ? 'SCLFolder_Priv.db' : 'SCLFolder_Publ.db'
}

/**
 * Open a read-only connection to the currently active mode's DB.
 * Returns null if the DB file does not exist (e.g. user hasn't run a scan yet).
 */
export function openSclFolderDb(): Database.Database | null {
  const path = join(sclDbDir(), dbFileName())
  if (!existsSync(path)) return null
  try {
    return new Database(path, { readonly: true, fileMustExist: true })
  } catch {
    return null
  }
}

export function withSclFolderDb<T>(fn: (db: Database.Database) => T, fallback: T): T {
  const db = openSclFolderDb()
  if (!db) return fallback
  try {
    return fn(db)
  } finally {
    db.close()
  }
}
