import { dialog, ipcMain } from 'electron'
import { existsSync, statSync } from 'node:fs'
import { IpcChannel } from '@shared/ipc-channels'
import { getLocAdmDb } from '../db/connection'
import { getFolderHealthReal } from '../db/scl-folder'
import { getMode } from './mode'
import { enqueueScan } from '../workers/scanRunner'
import type { FolderRow } from '@shared/types'

function assertFolder(path: string): void {
  if (!existsSync(path)) {
    throw new Error(`VALIDATION: Path does not exist — ${path}`)
  }
  if (!statSync(path).isDirectory()) {
    throw new Error(`VALIDATION: Not a directory — ${path}`)
  }
}

interface FolderDbRow {
  ID: number
  Path: string
  Include: 'Y' | 'N'
  ProcRound: number
  LastUpd_CT: number
}

function toFolderRow(r: FolderDbRow): FolderRow {
  const health = getFolderHealthReal(r.Path)
  return {
    id: r.ID,
    path: r.Path,
    include: r.Include,
    procRound: r.ProcRound,
    lastUpdCt: r.LastUpd_CT,
    fileCount: health.fileCount,
    dupeCount: health.dupeCount,
    privacyMatchCount: health.privacyMatchCount
  }
}

export function registerFolderHandlers(): void {
  ipcMain.handle(IpcChannel.FoldersList, (): FolderRow[] => {
    const rows = getLocAdmDb()
      .prepare('SELECT * FROM Folder ORDER BY Path')
      .all() as FolderDbRow[]
    return rows.map(toFolderRow)
  })

  ipcMain.handle(
    IpcChannel.FoldersAdd,
    (_evt, paths: string[], forceInclude?: 'Y' | 'N'): FolderRow[] => {
      const db = getLocAdmDb()
      const insert = db.prepare(
        `INSERT INTO Folder (Path, Include, ProcRound, LastUpd_CT)
         VALUES (?, ?, 0, strftime('%s', 'now'))`
      )
      const parentCheck = db.prepare(
        `SELECT 1 AS hit FROM Folder WHERE ? LIKE Path || '%' AND Include = 'Y' LIMIT 1`
      )
      // Two-pass design: the loc_adm INSERTs run inside one transaction so
      // the user's "add 5 folders" click is atomic against power-loss /
      // ROLLBACK. Health computation reads SCLFolder_{Publ,Priv}.db
      // (a DIFFERENT file the scanner may currently be writing to), so a
      // throw there must NOT poison the loc_adm transaction. Previously
      // a busy / missing / corrupted SCLFolder rolled back ALL inserts
      // and the user lost their add with only a generic toast to show
      // for it.
      const insertedRows: Array<{
        id: number
        path: string
        include: 'Y' | 'N'
        lastUpdCt: number
      }> = []
      const tx = db.transaction((items: string[]) => {
        for (const p of items) {
          let include: 'Y' | 'N'
          if (forceInclude) {
            include = forceInclude
          } else {
            const hasParent = parentCheck.get(p) as { hit?: number } | undefined
            include = hasParent?.hit ? 'N' : 'Y'
          }
          const info = insert.run(p, include)
          insertedRows.push({
            id: Number(info.lastInsertRowid),
            path: p,
            include,
            lastUpdCt: Math.floor(Date.now() / 1000)
          })
        }
      })
      tx(paths)

      // Kick off a background scan for each newly-included folder. Scans
      // run in filescanner.exe subprocesses (see workers/scanRunner.ts);
      // this loop returns immediately. OCR_Process tracks progress, the
      // dashboard's Active jobs card surfaces it via the existing 3s poll,
      // and a notification fires on completion. Excluded folders are
      // skipped because the user opted them out — re-enabling Include
      // doesn't trigger a scan today (defer to a "Scan now" button).
      const mode = getMode()
      for (const row of insertedRows) {
        if (row.include === 'Y') {
          try {
            enqueueScan({ targetFolder: row.path, mode })
          } catch {
            // Never let a scan-spawn failure poison the IPC return — the
            // loc_adm row is already persisted, scanRunner's recordError
            // handler captured the diagnostic, and the user can re-trigger
            // by removing+re-adding once they fix the underlying issue.
          }
        }
      }

      // Health pass: a failure here logs but doesn't propagate. The folder
      // row is already persisted; the user can refresh to recompute health
      // once the SCLFolder DB is reachable.
      const added: FolderRow[] = insertedRows.map((row) => {
        let fileCount = 0
        let dupeCount = 0
        let privacyMatchCount = 0
        try {
          const health = getFolderHealthReal(row.path)
          fileCount = health.fileCount
          dupeCount = health.dupeCount
          privacyMatchCount = health.privacyMatchCount
        } catch {
          /* SCLFolder DB locked / missing — leave zeros; refresh recomputes. */
        }
        return {
          id: row.id,
          path: row.path,
          include: row.include,
          procRound: 0,
          lastUpdCt: row.lastUpdCt,
          fileCount,
          dupeCount,
          privacyMatchCount
        }
      })
      return added
    }
  )

  ipcMain.handle(IpcChannel.FoldersRemove, (_evt, id: number) => {
    getLocAdmDb().prepare('DELETE FROM Folder WHERE ID = ?').run(id)
  })

  ipcMain.handle(IpcChannel.FoldersUpdatePath, (_evt, id: number, newPath: string) => {
    assertFolder(newPath)
    getLocAdmDb().prepare('UPDATE Folder SET Path = ? WHERE ID = ?').run(newPath, id)
  })

  // Toggle the existing row's Include flag. Used by the Switch on each
  // folder row in the UI; behaves as a true toggle so flipping a row no
  // longer creates a sibling Exclude entry.
  ipcMain.handle(IpcChannel.FoldersSetInclude, (_evt, id: number, include: 'Y' | 'N') => {
    if (include !== 'Y' && include !== 'N') {
      throw new Error(`VALIDATION: include must be 'Y' or 'N'`)
    }
    getLocAdmDb().prepare('UPDATE Folder SET Include = ? WHERE ID = ?').run(include, id)
  })

  ipcMain.handle(IpcChannel.FoldersPickDirectory, async (): Promise<string[]> => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'multiSelections']
    })
    return result.canceled ? [] : result.filePaths
  })
}
