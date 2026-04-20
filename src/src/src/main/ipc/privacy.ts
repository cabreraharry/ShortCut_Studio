import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import { getLocAdmDb } from '../db/connection'
import type { PrivacyTerm } from '@shared/types'

interface PrivacyDbRow {
  id: number
  term: string
  source: 'system' | 'user'
}

export function registerPrivacyHandlers(): void {
  ipcMain.handle(IpcChannel.PrivacyListTerms, (): PrivacyTerm[] => {
    const rows = getLocAdmDb()
      .prepare('SELECT * FROM PrivacyTerms ORDER BY source, term')
      .all() as PrivacyDbRow[]
    return rows.map((r) => ({ term: r.term, source: r.source }))
  })

  ipcMain.handle(IpcChannel.PrivacyUpdateTerms, (_evt, userTerms: string[]) => {
    const db = getLocAdmDb()
    db.transaction(() => {
      db.prepare("DELETE FROM PrivacyTerms WHERE source = 'user'").run()
      const insert = db.prepare(
        "INSERT INTO PrivacyTerms (term, source) VALUES (?, 'user')"
      )
      for (const t of userTerms) {
        const trimmed = t.trim()
        if (trimmed) insert.run(trimmed)
      }
    })()
  })
}
