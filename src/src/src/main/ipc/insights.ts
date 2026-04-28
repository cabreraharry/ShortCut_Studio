import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import type { InsightsListParams } from '@shared/types'
import { getLocAdmDb } from '../db/connection'
import {
  getDedupSummaryReal,
  getFolderHealthReal,
  listDocumentInsightsReal,
  listInsightsGroupsReal
} from '../db/scl-folder'

export function registerInsightsHandlers(): void {
  ipcMain.handle(IpcChannel.ProgressDedupSummary, () => getDedupSummaryReal())

  // The Folders page passes loc_adm.db's Folder.ID; resolve it to the configured
  // path before joining against SCLFolder. Returns zero-counts gracefully if the
  // ID is stale or no scan has populated the SCL DB yet.
  ipcMain.handle(IpcChannel.FoldersHealth, (_evt, folderId: number) => {
    const row = getLocAdmDb()
      .prepare('SELECT Path FROM Folder WHERE ID = ?')
      .get(folderId) as { Path: string } | undefined
    if (!row) return { fileCount: 0, dupeCount: 0, privacyMatchCount: 0 }
    return getFolderHealthReal(row.Path)
  })

  ipcMain.handle(IpcChannel.InsightsList, (_evt, params?: InsightsListParams) =>
    listDocumentInsightsReal(params)
  )
  ipcMain.handle(IpcChannel.InsightsGroups, (_evt, params?: { search?: string }) =>
    listInsightsGroupsReal(params)
  )
}
