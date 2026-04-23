import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { createMainWindow, markQuitting } from './window'
import { createTray, destroyTray } from './tray'
import { registerIpcHandlers } from './ipc'
import { initDatabase, closeDatabase } from './db/connection'
import { runMigrations } from './db/migrations'
import { startWorkerSupervisor, stopAllWorkers } from './workers/supervisor'
import { IpcChannel } from '@shared/ipc-channels'

let mainWindow: BrowserWindow | null = null

function attachDevModeShortcut(win: BrowserWindow): void {
  // Ctrl+Shift+D toggles the hidden Dev Mode overlay. Uses before-input-event
  // (window-scoped) rather than globalShortcut so other apps aren't blocked.
  win.webContents.on('before-input-event', (event, input) => {
    if (
      input.type === 'keyDown' &&
      input.key.toLowerCase() === 'd' &&
      input.control &&
      input.shift &&
      !input.alt &&
      !input.meta
    ) {
      event.preventDefault()
      win.webContents.send(IpcChannel.DevToggle)
    }
  })
}

async function bootstrap(): Promise<void> {
  await app.whenReady()
  initDatabase()
  runMigrations()
  registerIpcHandlers()
  startWorkerSupervisor()

  mainWindow = createMainWindow()
  attachDevModeShortcut(mainWindow)
  createTray(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
      if (mainWindow) attachDevModeShortcut(mainWindow)
    }
  })
}

app.on('window-all-closed', () => {
  // Keep running in tray on non-macOS too — app is tray-resident
  if (process.platform === 'darwin') app.quit()
})

app.on('before-quit', () => {
  markQuitting()
  destroyTray()
  stopAllWorkers()
  closeDatabase()
})

// Dev-mode: re-enable default menu accelerators for inspector, etc.
if (!app.isPackaged) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
}

bootstrap().catch((err) => {
  console.error('[main] bootstrap failed', err)
  app.exit(1)
})

export { mainWindow, join }
