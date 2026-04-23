import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import { openFile, revealFolder } from '../os/local-tools'

export function registerSystemHandlers(): void {
  ipcMain.handle(IpcChannel.SystemOpenFile, async (_evt, path: string) => {
    return openFile(path)
  })
  ipcMain.handle(IpcChannel.SystemRevealFolder, async (_evt, path: string) => {
    return revealFolder(path)
  })
}
