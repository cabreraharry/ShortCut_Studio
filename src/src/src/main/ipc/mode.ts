import { BrowserWindow, ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import type { DbMode } from '@shared/types'

let currentMode: DbMode = 'publ'

export function getMode(): DbMode {
  return currentMode
}

export function registerModeHandlers(): void {
  ipcMain.handle(IpcChannel.ModeGet, () => currentMode)
  ipcMain.handle(IpcChannel.ModeSet, (_evt, mode: DbMode) => {
    if (mode !== 'publ' && mode !== 'priv') {
      throw new Error(`VALIDATION: mode must be 'publ' or 'priv'`)
    }
    if (mode === currentMode) return
    currentMode = mode
    // Broadcast so the renderer can synchronously snapshot the new mode
    // and re-key its mode-sensitive React Query caches. Without this, an
    // in-flight query started in publ mode could land its response in
    // the priv-mode cache slot — the user would see private topics with
    // public file counts. Renderer-side every mode-dependent query keys
    // against ['<feature>', mode] (see useMode in @/hooks/use-mode), so
    // a mode flip naturally drops stale-mode results into a dead cache
    // slot rather than poisoning the active view.
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send(IpcChannel.ModeChanged, mode)
    }
  })
}
