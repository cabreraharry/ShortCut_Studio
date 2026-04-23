import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import { listDrives } from '../os/drives'
import { listChildren } from '../os/fs-preview'

export function registerDriveHandlers(): void {
  ipcMain.handle(IpcChannel.SystemListDrives, () => listDrives())
  ipcMain.handle(IpcChannel.SystemListChildren, (_evt, path: string) =>
    listChildren(path)
  )
}
