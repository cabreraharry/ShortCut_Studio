import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { createMainWindow } from './window'
import { createTray } from './tray'
import { registerIpcHandlers } from './ipc'
import { initDatabase, closeDatabase } from './db/connection'
import { runMigrations } from './db/migrations'
import { startWorkerSupervisor, stopAllWorkers } from './workers/supervisor'

let mainWindow: BrowserWindow | null = null

async function bootstrap(): Promise<void> {
  await app.whenReady()
  initDatabase()
  runMigrations()
  registerIpcHandlers()
  startWorkerSupervisor()

  mainWindow = createMainWindow()
  createTray(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
    }
  })
}

app.on('window-all-closed', () => {
  // Keep running in tray on non-macOS too — app is tray-resident
  if (process.platform === 'darwin') app.quit()
})

app.on('before-quit', () => {
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
