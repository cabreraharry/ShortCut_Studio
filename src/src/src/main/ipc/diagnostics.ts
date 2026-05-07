import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import { getWorkerStatuses, restartWorker, tailWorkerLog } from '../workers/supervisor'
import {
  clearAllErrors,
  listErrors,
  recordError
} from '../diagnostics/errorStore'
import { notify } from '../notifications/dispatch'
import {
  isBenignRendererError,
  shouldNotifyRendererError
} from '../notifications/rendererThrottle'
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
      let message = typeof payload.message === 'string' ? payload.message : String(payload.message ?? '')
      if (!message) return
      // Cap at 4 KB before any further processing. The errorStore re-caps at
      // the same threshold before write, but a buggy or malicious renderer
      // could send a multi-MB string and burn CPU on the coercion + cap path.
      // Truncate at the IPC boundary to keep the main process responsive.
      const MAX_MESSAGE_BYTES = 4 * 1024
      if (message.length > MAX_MESSAGE_BYTES) {
        message = message.slice(0, MAX_MESSAGE_BYTES) + '… [truncated]'
      }
      let stack = typeof payload.stack === 'string' ? payload.stack : undefined
      if (stack && stack.length > MAX_MESSAGE_BYTES * 4) {
        // Stacks are larger than messages but still bounded — 16 KB covers
        // the deepest realistic React component stack.
        stack = stack.slice(0, MAX_MESSAGE_BYTES * 4) + '… [truncated]'
      }
      // Cap context too — a buggy/malicious renderer can send an arbitrary
      // object that gets JSON-serialised into the AppErrors row. Mirror the
      // same defensive truncation as message + stack.
      let context = payload.context
      if (context !== undefined && context !== null) {
        try {
          const serialised = JSON.stringify(context)
          if (serialised.length > MAX_MESSAGE_BYTES * 4) {
            context = {
              truncated: true,
              note: 'context exceeded 16 KB limit; truncated at IPC boundary',
              preview: serialised.slice(0, 1024)
            }
          }
        } catch {
          // Unserialisable (cyclic ref, BigInt, etc.) — drop it rather than
          // crash the handler.
          context = { truncated: true, note: 'context not serialisable' }
        }
      }
      const category = typeof payload.category === 'string' ? payload.category : null
      recordError({
        source: 'renderer',
        severity: 'error',
        category,
        message,
        stack,
        context
      })

      // Notify the user only when we'd actually want them to look. AppErrors
      // (above) is always written; this is the "popup-worthy" subset.
      if (!isBenignRendererError(message) && shouldNotifyRendererError(category, message)) {
        notify({
          severity: 'error',
          source: 'main',
          title: 'Something went wrong',
          // Body uses the raw message rather than category so the user sees
          // what broke. The full stack lives in Settings → Diagnostics.
          body: message,
          action: { kind: 'navigate', target: '/settings#diagnostics' }
        })
      }
    }
  )
}
