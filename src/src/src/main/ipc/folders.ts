import { dialog, ipcMain } from 'electron'
import { existsSync, statSync } from 'node:fs'
import { IpcChannel } from '@shared/ipc-channels'
import { getLocAdmDb } from '../db/connection'
import { getFolderHealthReal } from '../db/scl-folder'
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
      const added: FolderRow[] = []
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
          const health = getFolderHealthReal(p)
          added.push({
            id: Number(info.lastInsertRowid),
            path: p,
            include,
            procRound: 0,
            lastUpdCt: Math.floor(Date.now() / 1000),
            fileCount: health.fileCount,
            dupeCount: health.dupeCount,
            privacyMatchCount: health.privacyMatchCount
          })
        }
      })
      tx(paths)
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

  ipcMain.handle(IpcChannel.FoldersPickDirectory, async (): Promise<string[]> => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'multiSelections']
    })
    return result.canceled ? [] : result.filePaths
  })
}
