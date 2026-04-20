import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import { getLocAdmDb } from '../db/connection'
import type { FileTypeFilter } from '@shared/types'

interface FileTypeDbRow {
  extension: string
  label: string
  enabled: number
  sortOrder: number
}

function toFilter(r: FileTypeDbRow): FileTypeFilter {
  return {
    extension: r.extension,
    label: r.label,
    enabled: r.enabled === 1
  }
}

export function registerFileTypeHandlers(): void {
  ipcMain.handle(IpcChannel.FileTypesList, (): FileTypeFilter[] => {
    const rows = getLocAdmDb()
      .prepare('SELECT * FROM FileTypeFilters ORDER BY sortOrder, extension')
      .all() as FileTypeDbRow[]
    return rows.map(toFilter)
  })

  ipcMain.handle(
    IpcChannel.FileTypesToggle,
    (_evt, extension: string, enabled: boolean) => {
      getLocAdmDb()
        .prepare('UPDATE FileTypeFilters SET enabled = ? WHERE extension = ?')
        .run(enabled ? 1 : 0, extension)
    }
  )

  ipcMain.handle(
    IpcChannel.FileTypesAdd,
    (_evt, extension: string, label: string): FileTypeFilter => {
      const ext = extension.startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`
      const db = getLocAdmDb()
      const maxOrder = db
        .prepare('SELECT COALESCE(MAX(sortOrder), 0) AS m FROM FileTypeFilters')
        .get() as { m: number }
      db.prepare(
        'INSERT OR REPLACE INTO FileTypeFilters (extension, label, enabled, sortOrder) VALUES (?, ?, 1, ?)'
      ).run(ext, label || ext.slice(1).toUpperCase(), maxOrder.m + 1)
      return { extension: ext, label: label || ext.slice(1).toUpperCase(), enabled: true }
    }
  )

  ipcMain.handle(IpcChannel.FileTypesRemove, (_evt, extension: string) => {
    getLocAdmDb().prepare('DELETE FROM FileTypeFilters WHERE extension = ?').run(extension)
  })
}
