import Database from 'better-sqlite3'
import { app } from 'electron'
import { join, dirname } from 'node:path'
import { existsSync, mkdirSync, copyFileSync } from 'node:fs'

let locAdmDb: Database.Database | null = null

/**
 * Resolve the path to loc_adm.db. In dev, use the in-repo copy under
 * src/src/db_files/. In production, use userData so upgrades don't
 * clobber user state. First-run copies the bundled seed over.
 */
function locAdmDbPath(): string {
  if (app.isPackaged) {
    const userDir = join(app.getPath('userData'), 'db_files')
    if (!existsSync(userDir)) mkdirSync(userDir, { recursive: true })
    const target = join(userDir, 'loc_adm.db')
    if (!existsSync(target)) {
      const bundledSeed = join(process.resourcesPath, 'db_files', 'loc_adm.db')
      if (existsSync(bundledSeed)) copyFileSync(bundledSeed, target)
    } 
    return target
  }
  // dev
  return join(__dirname, '../../db_files/loc_adm.db')
}

export function initDatabase(): Database.Database {
  if (locAdmDb) return locAdmDb
  const path = locAdmDbPath()
  mkdirSync(dirname(path), { recursive: true })
  locAdmDb = new Database(path)
  locAdmDb.pragma('journal_mode = WAL')
  locAdmDb.pragma('foreign_keys = ON')
  return locAdmDb
}

export function getLocAdmDb(): Database.Database {
  if (!locAdmDb) return initDatabase()
  return locAdmDb
}

export function closeDatabase(): void {
  if (locAdmDb) {
    locAdmDb.close()
    locAdmDb = null
  }
}
