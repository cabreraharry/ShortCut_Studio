import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { createMainWindow, markQuitting } from './window'
import { createTray, destroyTray } from './tray'
import { registerIpcHandlers } from './ipc'
import { initDatabase, closeDatabase } from './db/connection'
import { initErrorsDb, closeErrorsDb } from './db/errorsConnection'
import { runMigrations } from './db/migrations'
import { startWorkerSupervisor, stopAllWorkers } from './workers/supervisor'
import { startLlmBridgeServer, stopLlmBridgeServer } from './llm/bridgeServer'
import { initAuthState, verifyPersistedToken } from './execengine/authState'
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
  // Errors DB is its own file (db_files/errors.db) — see errorsConnection.ts.
  // Init before registerIpcHandlers so the IPC error trap can write rows
  // from the very first throw.
  initErrorsDb()
  // ExecEngine auth state must be initialized AFTER migrations run (it reads
  // AdminData columns that the migration creates) and BEFORE IPC handlers
  // register (the factory in client.ts subscribes to state changes on first
  // call from any handler).
  initAuthState()
  registerIpcHandlers()
  // LLM bridge must start BEFORE the supervisor — workers spawned by the
  // supervisor need the bridge port available in their env to make their
  // first call. AWAIT the listen callback so a fast-spawning worker doesn't
  // race the bind syscall and get ECONNREFUSED on its first request.
  await startLlmBridgeServer()
  startWorkerSupervisor()
  // Fire-and-forget: confirm any persisted token is still valid against SIS.
  // We don't block boot on this — UI surfaces 'connected' optimistically and
  // downgrades to 'expired' if SIS rejects.
  void verifyPersistedToken()

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
  stopLlmBridgeServer()
  // Independent try/catch per DB so a throw in one (e.g. better-sqlite3 throws
  // TypeError on double-close) doesn't leak the other handle.
  try {
    closeDatabase()
  } catch (err) {
    console.error('[main] closeDatabase failed', err)
  }
  try {
    closeErrorsDb()
  } catch (err) {
    console.error('[main] closeErrorsDb failed', err)
  }
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
