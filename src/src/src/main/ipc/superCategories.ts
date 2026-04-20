import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import { getLocAdmDb } from '../db/connection'
import { withSclFolderDb } from '../db/scl-folder'
import type { SuperCategory } from '@shared/types'

interface SuperCatDbRow {
  SuperCategoryID: number
  Name: string
}

interface MapDbRow {
  topicName: string
  superCategoryId: number
}

export function registerSuperCategoryHandlers(): void {
  ipcMain.handle(IpcChannel.SuperCategoriesList, (): SuperCategory[] => {
    const db = getLocAdmDb()
    const cats = db
      .prepare('SELECT * FROM SuperCategories ORDER BY Name')
      .all() as SuperCatDbRow[]
    const maps = db
      .prepare('SELECT topicName, superCategoryId FROM TopicSuperCategoryMap')
      .all() as MapDbRow[]

    const byCat = new Map<number, string[]>()
    for (const m of maps) {
      const list = byCat.get(m.superCategoryId) ?? []
      list.push(m.topicName)
      byCat.set(m.superCategoryId, list)
    }
    // Also filter to only include topics that actually exist in the scan DB
    // (so UI doesn't list stale mappings); falls back to raw list if scan DB absent.
    const validTopics = withSclFolderDb<Set<string> | null>((sdb) => {
      const rows = sdb.prepare('SELECT TopicName FROM TopicNames').all() as {
        TopicName: string
      }[]
      return new Set(rows.map((r) => r.TopicName))
    }, null)

    return cats.map((c) => ({
      superCategoryId: c.SuperCategoryID,
      name: c.Name,
      topicNames: (byCat.get(c.SuperCategoryID) ?? []).filter((t) =>
        validTopics ? validTopics.has(t) : true
      )
    }))
  })

  ipcMain.handle(IpcChannel.SuperCategoriesCreate, (_evt, name: string): SuperCategory => {
    const info = getLocAdmDb()
      .prepare('INSERT INTO SuperCategories (Name) VALUES (?)')
      .run(name)
    return { superCategoryId: Number(info.lastInsertRowid), name, topicNames: [] }
  })

  ipcMain.handle(IpcChannel.SuperCategoriesRename, (_evt, id: number, name: string) => {
    getLocAdmDb().prepare('UPDATE SuperCategories SET Name = ? WHERE SuperCategoryID = ?').run(
      name,
      id
    )
  })

  ipcMain.handle(IpcChannel.SuperCategoriesRemove, (_evt, id: number) => {
    // ON DELETE CASCADE on TopicSuperCategoryMap handles the mapping cleanup.
    getLocAdmDb().prepare('DELETE FROM SuperCategories WHERE SuperCategoryID = ?').run(id)
  })

  ipcMain.handle(
    IpcChannel.SuperCategoriesAssign,
    (_evt, topicName: string, superCategoryId: number) => {
      getLocAdmDb()
        .prepare(
          'INSERT OR REPLACE INTO TopicSuperCategoryMap (topicName, superCategoryId) VALUES (?, ?)'
        )
        .run(topicName, superCategoryId)
    }
  )

  ipcMain.handle(IpcChannel.SuperCategoriesUnassign, (_evt, topicName: string) => {
    getLocAdmDb().prepare('DELETE FROM TopicSuperCategoryMap WHERE topicName = ?').run(topicName)
  })
}
