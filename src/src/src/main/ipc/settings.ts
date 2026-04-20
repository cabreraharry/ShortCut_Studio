import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import { getLocAdmDb } from '../db/connection'
import type { AppSettings } from '@shared/types'

interface AdminDbRow {
  RecID: number
  Localhost_Port: number
  NumTopicThreshold: number
  CPU_Perf_Threshold: number
}

function toSettings(r: AdminDbRow): AppSettings {
  return {
    recId: r.RecID,
    localhostPort: r.Localhost_Port,
    numTopicThreshold: r.NumTopicThreshold,
    cpuPerfThreshold: r.CPU_Perf_Threshold
  }
}

export function registerSettingsHandlers(): void {
  ipcMain.handle(IpcChannel.SettingsGet, (): AppSettings => {
    const row = getLocAdmDb()
      .prepare('SELECT * FROM AdminData WHERE RecID = 1')
      .get() as AdminDbRow
    return toSettings(row)
  })

  ipcMain.handle(IpcChannel.SettingsUpdate, (_evt, patch: Partial<AppSettings>) => {
    const db = getLocAdmDb()
    const fields: string[] = []
    const values: (number | string)[] = []
    if (patch.localhostPort !== undefined) {
      fields.push('Localhost_Port = ?')
      values.push(patch.localhostPort)
    }
    if (patch.numTopicThreshold !== undefined) {
      fields.push('NumTopicThreshold = ?')
      values.push(patch.numTopicThreshold)
    }
    if (patch.cpuPerfThreshold !== undefined) {
      fields.push('CPU_Perf_Threshold = ?')
      values.push(patch.cpuPerfThreshold)
    }
    if (fields.length === 0) return
    values.push(1)
    db.prepare(`UPDATE AdminData SET ${fields.join(', ')} WHERE RecID = ?`).run(...values)
  })
}
