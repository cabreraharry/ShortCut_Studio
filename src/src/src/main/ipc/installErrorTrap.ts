import { ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { recordError, redactArgs } from '../diagnostics/errorStore'

type HandleListener = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown | Promise<unknown>

/**
 * Wrap ipcMain.handle so every throw inside any registered handler gets
 * persisted to the AppErrors table before being re-thrown to the renderer.
 *
 * Single-point trap — beats touching all 22 register*Handlers files.
 *
 * VALIDATION:-prefixed throws are tagged 'warning' so the default
 * Errors-panel filter (severity='error') hides user-input validation noise.
 */
export function installIpcErrorTrap(): void {
  const origHandle = ipcMain.handle.bind(ipcMain)
  ipcMain.handle = ((channel: string, listener: HandleListener) => {
    return origHandle(channel, async (event, ...args) => {
      try {
        return await listener(event, ...args)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        recordError({
          source: 'ipc',
          severity: msg.startsWith('VALIDATION:') ? 'warning' : 'error',
          category: channel,
          message: msg,
          stack: err instanceof Error ? err.stack : undefined,
          context: { args: redactArgs(args) }
        })
        throw err
      }
    })
  }) as typeof ipcMain.handle
}
