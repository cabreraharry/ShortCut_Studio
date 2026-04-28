import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import { getExecEngine } from '../execengine/client'
import type {
  Job,
  ProgressByStage,
  ProgressHistoryPoint,
  ProgressSummary,
  TimeRange
} from '@shared/types'

export function registerProgressHandlers(): void {
  ipcMain.handle(
    IpcChannel.ProgressSummary,
    async (_evt, range: TimeRange): Promise<ProgressSummary> => {
      return getExecEngine().getProgressSummary(range)
    }
  )

  ipcMain.handle(IpcChannel.ProgressJobs, async (): Promise<Job[]> => {
    return getExecEngine().listJobs()
  })

  ipcMain.handle(
    IpcChannel.ProgressHistory,
    async (_evt, range: TimeRange): Promise<ProgressHistoryPoint[]> => {
      return getExecEngine().getProgressHistory(range)
    }
  )

  ipcMain.handle(
    IpcChannel.ProgressByStage,
    async (_evt, range: TimeRange): Promise<ProgressByStage> => {
      return getExecEngine().getProgressByStage(range)
    }
  )
}
