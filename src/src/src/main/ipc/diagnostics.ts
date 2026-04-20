import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import { getWorkerStatuses, restartWorker, tailWorkerLog } from '../workers/supervisor'
import type { WorkerStatus } from '@shared/types'

export function registerDiagnosticsHandlers(): void {
  ipcMain.handle(IpcChannel.DiagnosticsWorkers, (): WorkerStatus[] => {
    return getWorkerStatuses()
  })

  ipcMain.handle(IpcChannel.DiagnosticsRestartWorker, async (_evt, name: string) => {
    await restartWorker(name)
  })

  ipcMain.handle(
    IpcChannel.DiagnosticsTailLog,
    async (_evt, name: string, lines?: number): Promise<string> => {
      return tailWorkerLog(name, lines ?? 200)
    }
  )
}
