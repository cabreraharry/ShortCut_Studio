import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import { getStatus, checkForUpdate, applyUpdate } from '../updater'

export function registerUpdaterHandlers(): void {
  ipcMain.handle(IpcChannel.UpdaterStatus, () => getStatus())
  ipcMain.handle(IpcChannel.UpdaterCheck, () => checkForUpdate())
  ipcMain.handle(IpcChannel.UpdaterApply, () => applyUpdate())
}
