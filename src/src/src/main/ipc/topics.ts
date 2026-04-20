import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import type { Topic, TopicReviewItem } from '@shared/types'

// Topic data lives in SCLFolder_{Publ,Priv}.db (SCL_Demo's scanner DBs).
// For v1 scaffolding, return stub data; the Topics feature task wires up
// the real queries against the mode-selected DB.

export function registerTopicHandlers(): void {
  ipcMain.handle(IpcChannel.TopicsList, (): Topic[] => {
    return []
  })

  ipcMain.handle(IpcChannel.TopicsGenerate, (_evt, _folderId?: number) => {
    return { jobId: `topic-gen-${Date.now()}` }
  })

  ipcMain.handle(IpcChannel.TopicsReview, (): TopicReviewItem[] => {
    return []
  })

  ipcMain.handle(IpcChannel.TopicsApprove, (_evt, _items: TopicReviewItem[]) => {
    // stub
  })
}
