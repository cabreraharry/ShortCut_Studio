import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import { getLocAdmDb } from '../db/connection'
import { withSclFolderDb } from '../db/scl-folder'
import type { Topic, TopicListResult, TopicReviewItem } from '@shared/types'

interface TopicDbRow {
  TopicID: number
  TopicName: string
  FolderName: string
  ManualGenerated: 'Y' | 'N'
  fileCount: number
}

interface MapDbRow {
  topicName: string
  superCategoryId: number
}

export function registerTopicHandlers(): void {
  ipcMain.handle(IpcChannel.TopicsList, (): TopicListResult => {
    return withSclFolderDb<TopicListResult>(
      (db) => {
        const rows = db
          .prepare(
            `SELECT t.TopicID, t.TopicName, COALESCE(t.FolderName, '') AS FolderName,
                    COALESCE(t.ManualGenerated, 'N') AS ManualGenerated,
                    (SELECT COUNT(*) FROM TopicFiles tf WHERE tf.TopicID = t.TopicID) AS fileCount
               FROM TopicNames t
               ORDER BY t.TopicName`
          )
          .all() as TopicDbRow[]

        const maps = getLocAdmDb()
          .prepare('SELECT topicName, superCategoryId FROM TopicSuperCategoryMap')
          .all() as MapDbRow[]
        const mapByName = new Map(maps.map((m) => [m.topicName, m.superCategoryId]))

        const topics: Topic[] = rows.map((r) => ({
          topicId: r.TopicID,
          topicName: r.TopicName,
          folderName: r.FolderName,
          manualGenerated: r.ManualGenerated,
          fileCount: r.fileCount,
          superCategoryId: mapByName.get(r.TopicName)
        }))
        return { topics, scanDbMissing: false }
      },
      { topics: [], scanDbMissing: true }
    )
  })

  ipcMain.handle(IpcChannel.TopicsGenerate, (_evt, folderId?: number) => {
    const db = getLocAdmDb()
    const info = db
      .prepare(
        `INSERT INTO OCR_Process (Kind, Status, Label, StartedAt, ProgressCurrent, ProgressTotal)
           VALUES ('topics', 'queued', ?, strftime('%s','now'), 0, 0)`
      )
      .run(folderId ? `Topics for folder ${folderId}` : 'Topic generation (all folders)')
    return { jobId: `job-${info.lastInsertRowid}` }
  })

  ipcMain.handle(IpcChannel.TopicsReview, (): TopicReviewItem[] => {
    // Real queue comes from the gemini_processor worker. For v1, return empty —
    // the review page shows a helpful empty state.
    return []
  })

  ipcMain.handle(IpcChannel.TopicsApprove, (_evt, _items: TopicReviewItem[]) => {
    // Real approval writes to TopicNames/TopicFiles via a scanner-owned worker.
    // v1 stub — awaiting worker supervisor.
  })
}
