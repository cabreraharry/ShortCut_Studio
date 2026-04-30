import { app, ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import type { LoginItemSettings } from '@shared/types'
import { safeOpenExternal } from '../security/safeUrl'

const HIDDEN_ARG = '--hidden'

// Read the current registry-backed login-item state. Electron's return type
// doesn't include the args back-channel (those are write-only on the input),
// so we probe twice: once unfiltered (is ANY entry for our exec registered?)
// and once with our --hidden variant (does the registered entry match?). The
// hidden-variant probe is reliable because setLoginItemSettings always rounds
// through this exact path+args shape on the write side.
function readLoginItem(): LoginItemSettings {
  const any = app.getLoginItemSettings()
  if (!any.openAtLogin) {
    return { openAtLogin: false, startHidden: false }
  }
  const hidden = app.getLoginItemSettings({
    path: process.execPath,
    args: [HIDDEN_ARG]
  })
  return { openAtLogin: true, startHidden: hidden.openAtLogin }
}

export function registerAppHandlers(): void {
  ipcMain.handle(IpcChannel.AppQuit, () => {
    app.quit()
  })

  ipcMain.handle(IpcChannel.AppOpenExternal, async (_evt, url: string) => {
    // Scheme allowlist (https/http only) — see security/safeUrl.ts. Renderer
    // callers get a quiet boolean; details land in the Errors panel.
    await safeOpenExternal(url)
  })

  ipcMain.handle(IpcChannel.AppGetVersion, () => app.getVersion())

  ipcMain.handle(IpcChannel.AppGetLoginItem, (): LoginItemSettings => {
    return readLoginItem()
  })

  ipcMain.handle(
    IpcChannel.AppSetLoginItem,
    (_evt, next: LoginItemSettings): LoginItemSettings => {
      // app.setLoginItemSettings on Windows writes to
      // HKCU\Software\Microsoft\Windows\CurrentVersion\Run, which is the same
      // registry key Task Manager's Startup tab reads. The args we set here
      // get appended to the auto-launch command line; window.ts checks for
      // --hidden to keep the window unsplashed on tray-resident starts.
      const args: string[] = []
      if (next.startHidden) args.push(HIDDEN_ARG)
      app.setLoginItemSettings({
        openAtLogin: next.openAtLogin,
        // Empty args means "no command-line append" so toggling startHidden
        // off cleans up the registry value rather than leaving stale flags.
        args
      })
      return readLoginItem()
    }
  )
}
