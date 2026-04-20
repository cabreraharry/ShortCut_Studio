import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import type { DbMode } from '@shared/types'

let currentMode: DbMode = 'publ'

export function getMode(): DbMode {
  return currentMode
}

export function registerModeHandlers(): void {
  ipcMain.handle(IpcChannel.ModeGet, () => currentMode)
  ipcMain.handle(IpcChannel.ModeSet, (_evt, mode: DbMode) => {
    currentMode = mode
  })
}
