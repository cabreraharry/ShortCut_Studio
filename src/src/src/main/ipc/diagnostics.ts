import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import { getWorkerStatuses, restartWorker, tailWorkerLog } from '../workers/supervisor'
import {
  clearAllErrors,
  listErrors,
  recordError
} from '../diagnostics/errorStore'
import type {
  ErrorListQuery,
  ErrorListResult,
  RecordRendererErrorPayload,
  WorkerStatus
} from '@shared/types'

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

  ipcMain.handle(
    IpcChannel.DiagnosticsListErrors,
    (_evt, query?: ErrorListQuery): ErrorListResult => {
      return listErrors(query ?? {})
    }
  )

  ipcMain.handle(
    IpcChannel.DiagnosticsClearErrors,
    (): { deleted: number } => {
      return clearAllErrors()
    }
  )

  ipcMain.handle(
    IpcChannel.DiagnosticsRecordRendererError,
    (_evt, payload: RecordRendererErrorPayload): void => {
      // Defense-in-depth: payload comes from the renderer.
      if (!payload || typeof payload !== 'object') return
      const message = typeof payload.message === 'string' ? payload.message : String(payload.message ?? '')
      if (!message) return
      recordError({
        source: 'renderer',
        severity: 'error',
        category: typeof payload.category === 'string' ? payload.category : null,
        message,
        stack: typeof payload.stack === 'string' ? payload.stack : undefined,
        context: payload.context
      })
    }
  )
}
