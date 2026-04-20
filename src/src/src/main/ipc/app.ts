import { app, ipcMain, shell } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'

export function registerAppHandlers(): void {
  ipcMain.handle(IpcChannel.AppQuit, () => {
    app.quit()
  })

  ipcMain.handle(IpcChannel.AppOpenExternal, async (_evt, url: string) => {
    await shell.openExternal(url)
  })

  ipcMain.handle(IpcChannel.AppGetVersion, () => app.getVersion())
}
