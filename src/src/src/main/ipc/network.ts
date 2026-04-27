import { ipcMain } from 'electron'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { IpcChannel } from '@shared/ipc-channels'
import type { DbFileInfo, NetworkSummary } from '@shared/types'
import { getExecEngine } from '../execengine/client'
import { getLocAdmDb } from '../db/connection'

/**
 * Enriches the mock's NetworkSummary with REAL on-disk DB file sizes.
 *
 * The mock can't easily resolve packaged-vs-dev paths, so it leaves
 * `dbFiles: []`. This handler stats the actual `.db` files we ship with
 * (loc_adm.db plus SCL_Demo's mode-specific DBs) and prepends them to the
 * payload, with a `Hash_Tracking_DB` placeholder row to signal v2.
 */

const SCL_DEMO_DEFAULT_DB_DIR = 'D:/Client-Side_Project/SCL_Demo/db_files'

function sclDemoDbDir(): string {
  return process.env['SCL_DEMO_DB_DIR'] ?? SCL_DEMO_DEFAULT_DB_DIR
}

async function statSafe(path: string): Promise<number | null> {
  try {
    const s = await stat(path)
    return s.isFile() ? s.size : null
  } catch {
    return null
  }
}

async function collectDbFiles(): Promise<DbFileInfo[]> {
  const files: DbFileInfo[] = []

  // 1. loc_adm.db — reuse the same path the connection module resolved.
  const locAdmPath = getLocAdmDb().name
  files.push({
    name: 'loc_adm.db',
    path: locAdmPath,
    sizeBytes: await statSafe(locAdmPath)
  })

  // 2. SCL_Demo's two mode-specific scan DBs. Either may be missing
  // (the user hasn't scanned in that mode yet) — show null/missing.
  const sclDir = sclDemoDbDir()
  const publPath = join(sclDir, 'SCLFolder_Publ.db')
  const privPath = join(sclDir, 'SCLFolder_Priv.db')
  files.push({
    name: 'SCLFolder_Publ.db',
    path: publPath,
    sizeBytes: await statSafe(publPath)
  })
  files.push({
    name: 'SCLFolder_Priv.db',
    path: privPath,
    sizeBytes: await statSafe(privPath)
  })

  // 3. Hash_Tracking_DB — reserved for v2. Show as a placeholder so users
  // see what's coming.
  files.push({
    name: 'Hash_Tracking_DB',
    path: '(v2 — Consumer Peer dedup table)',
    sizeBytes: null,
    reservedForV2: true
  })

  return files
}

export function registerNetworkHandlers(): void {
  ipcMain.handle(IpcChannel.NetworkSummary, async (): Promise<NetworkSummary> => {
    const summary = await getExecEngine().getNetworkSummary()
    const dbFiles = await collectDbFiles()
    return { ...summary, dbFiles }
  })
}
