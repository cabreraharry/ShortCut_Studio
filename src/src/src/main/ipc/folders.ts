import { dialog, ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import { getLocAdmDb } from '../db/connection'
import type { FolderRow } from '@shared/types'

interface FolderDbRow {
  ID: number
  Path: string
  Include: 'Y' | 'N'
  ProcRound: number
  LastUpd_CT: number
}

function toFolderRow(r: FolderDbRow): FolderRow {
  return {
    id: r.ID,
    path: r.Path,
    include: r.Include,
    procRound: r.ProcRound,
    lastUpdCt: r.LastUpd_CT
  }
}

export function registerFolderHandlers(): void {
  ipcMain.handle(IpcChannel.FoldersList, (): FolderRow[] => {
    const rows = getLocAdmDb()
      .prepare('SELECT * FROM Folder ORDER BY Path')
      .all() as FolderDbRow[]
    return rows.map(toFolderRow)
  })

  ipcMain.handle(IpcChannel.FoldersAdd, (_evt, paths: string[]): FolderRow[] => {
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
        const hasParent = parentCheck.get(p) as { hit?: number } | undefined
        const include: 'Y' | 'N' = hasParent?.hit ? 'N' : 'Y'
        const info = insert.run(p, include)
        added.push({
          id: Number(info.lastInsertRowid),
          path: p,
          include,
          procRound: 0,
          lastUpdCt: Math.floor(Date.now() / 1000)
        })
      }
    })
    tx(paths)
    return added
  })

  ipcMain.handle(IpcChannel.FoldersRemove, (_evt, id: number) => {
    getLocAdmDb().prepare('DELETE FROM Folder WHERE ID = ?').run(id)
  })

  ipcMain.handle(IpcChannel.FoldersUpdatePath, (_evt, id: number, newPath: string) => {
    getLocAdmDb().prepare('UPDATE Folder SET Path = ? WHERE ID = ?').run(newPath, id)
  })

  ipcMain.handle(IpcChannel.FoldersPickDirectory, async (): Promise<string[]> => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'multiSelections']
    })
    return result.canceled ? [] : result.filePaths
  })
}
