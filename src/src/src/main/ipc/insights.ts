import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import type { InsightsListParams } from '@shared/types'
import {
  getDedupSummary,
  getFolderHealth,
  listDocumentInsights,
  listInsightsGroups
} from '../mock/insights'

export function registerInsightsHandlers(): void {
  ipcMain.handle(IpcChannel.ProgressDedupSummary, () => getDedupSummary())
  ipcMain.handle(IpcChannel.FoldersHealth, (_evt, folderId: number) =>
    getFolderHealth(folderId)
  )
  ipcMain.handle(IpcChannel.InsightsList, (_evt, params?: InsightsListParams) =>
    listDocumentInsights(params)
  )
  ipcMain.handle(IpcChannel.InsightsGroups, (_evt, params?: { search?: string }) =>
    listInsightsGroups(params)
  )
}

export { getDedupSummary, getFolderHealth, listDocumentInsights, listInsightsGroups }
