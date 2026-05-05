import { app, BrowserWindow, dialog } from 'electron'
import { join } from 'node:path'
import { createMainWindow, markQuitting } from './window'
import { createTray, destroyTray } from './tray'
import { registerIpcHandlers } from './ipc'
import { initDatabase, closeDatabase } from './db/connection'
import { initErrorsDb, closeErrorsDb } from './db/errorsConnection'
import { runMigrations } from './db/migrations'
import { startWorkerSupervisor, stopAllWorkersAsync } from './workers/supervisor'
import { startLlmBridgeServer, stopLlmBridgeServer } from './llm/bridgeServer'
import { recordError } from './diagnostics/errorStore'
import { initAuthState, verifyPersistedToken } from './execengine/authState'
import { startUpdater, stopUpdater } from './updater'
import { IpcChannel } from '@shared/ipc-channels'

/**
 * Detect the better-sqlite3 native-module-version mismatch that follows an
 * Electron version bump (most commonly after the in-app updater installs a
 * new release that bundled a different Node.js ABI). The error surfaces
 * during `new Database(path)` and the message contains the literal token
 * "NODE_MODULE_VERSION". Returns null for any other error shape — caller
 * should re-throw / handle generically.
 */
function nativeModuleMismatchHint(err: unknown): string | null {
  const message = err instanceof Error ? err.message : String(err)
  if (message.includes('NODE_MODULE_VERSION') || message.includes('was compiled against')) {
    return (
      'ShortCut Studio could not load its database driver because a native module ' +
      'is built against a different Node.js / Electron version than the one this ' +
      'installation ships with. This usually means a partial or interrupted update.\n\n' +
      'How to fix:\n' +
      '  1. Re-run the latest installer (downloads a fresh build).\n' +
      '  2. (Dev) From src/src run: npx electron-rebuild\n\n' +
      'Underlying error:\n' +
      message
    )
  }
  return null
}

/**
 * Show a fatal-startup error dialog and exit. Packaged builds have no
 * console, so without this the app would crash to desktop after the splash
 * with no indication of what failed. Dev builds keep the console.error so
 * the developer sees the full stack.
 *
 * `fatalDialogShown` is a once-flag — the per-stage `try/catch` in
 * bootstrap calls this and re-throws (the throw at the bottom is a hard
 * fence to satisfy the `never` return type). The re-throw escapes the
 * try/catch, propagates out of bootstrap, and lands in the
 * bootstrap().catch handler — which would otherwise show a SECOND dialog
 * for the same failure. The flag suppresses the duplicate.
 */
let fatalDialogShown = false
function fatalStartupAndExit(err: unknown, stage: string): never {
  if (fatalDialogShown) {
    // eslint-disable-next-line no-console
    console.error(`[main] ${stage} failed (suppressed dup dialog)`, err)
    app.exit(1)
    throw err
  }
  fatalDialogShown = true
  const hint = nativeModuleMismatchHint(err)
  // Always log too — useful in dev where the dialog is a paper-cut.
  // eslint-disable-next-line no-console
  console.error(`[main] ${stage} failed`, err)
  if (hint !== null) {
    dialog.showErrorBox('ShortCut Studio — startup error', hint)
  } else {
    const message = err instanceof Error ? err.message : String(err)
    dialog.showErrorBox(
      'ShortCut Studio — startup error',
      `Failed during ${stage}:\n\n${message}\n\nIf this persists, re-run the installer.`
    )
  }
  // app.exit calls process.exit synchronously on the next event loop tick;
  // the throw below is a TypeScript fence so callers can't accidentally
  // continue past this function (the `never` contract).
  app.exit(1)
  throw err
}

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
  // Database init is the single highest-risk step at boot — better-sqlite3
  // is a native module and a NODE_MODULE_VERSION mismatch following an
  // Electron version bump throws here. Without an explicit dialog the app
  // would silently crash to desktop after the splash flash. Same wrapping
  // for the migration step + errorsDb init so any startup-fatal failure
  // gets a user-readable explanation rather than a silent exit(1).
  try {
    initDatabase()
  } catch (err) {
    fatalStartupAndExit(err, 'database initialization')
  }
  try {
    runMigrations()
  } catch (err) {
    fatalStartupAndExit(err, 'database migration')
  }
  // Errors DB is its own file (db_files/errors.db) — see errorsConnection.ts.
  // Init before registerIpcHandlers so the IPC error trap can write rows
  // from the very first throw.
  try {
    initErrorsDb()
  } catch (err) {
    fatalStartupAndExit(err, 'errors-database initialization')
  }
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
  //
  // Failure here usually means the port is occupied by another process (a
  // crashed previous instance, a VPN client, dev tooling). Workers still
  // start so the rest of the app is usable, but topic generation will fail
  // until the conflict is resolved + the app is restarted.
  try {
    await startLlmBridgeServer()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    recordError({
      source: 'main',
      severity: 'error',
      category: 'llm-bridge-startup',
      message: `LLM bridge failed to start: ${message}`,
      context: { likelyCause: 'port 45123 in use by another process' }
    })
  }
  startWorkerSupervisor()
  // Fire-and-forget: confirm any persisted token is still valid against SIS.
  // We don't block boot on this — UI surfaces 'connected' optimistically and
  // downgrades to 'expired' if SIS rejects.
  void verifyPersistedToken()

  mainWindow = createMainWindow()
  attachDevModeShortcut(mainWindow)
  createTray(mainWindow)

  // In-app updater. No-op in dev (updater detects !app.isPackaged and just
  // sets state to 'disabled-dev'). Runs the first manifest fetch ~30s after
  // boot so the user's first-load isn't blocked on a network roundtrip.
  startUpdater()

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

// Async shutdown via preventDefault + app.quit on completion. Without
// this, stopAllWorkers ran synchronously and any "wait for graceful
// SIGTERM exit" was effectively skipped (Node hadn't run the exit
// listeners yet by the time the next sync line ran). The preventDefault
// pattern lets us actually wait for Python workers' shutdown handlers
// (log flush, DB cursor close) before force-killing survivors.
let shuttingDown = false
app.on('before-quit', (event) => {
  if (shuttingDown) return
  event.preventDefault()
  shuttingDown = true
  void shutdownAndQuit()
})

async function shutdownAndQuit(): Promise<void> {
  markQuitting()
  destroyTray()
  stopUpdater()
  // killWithEscalation gives each worker up to 2 s to exit cleanly on
  // SIGTERM before taskkill /F /T. Run in parallel — three workers
  // shutting down independently is faster than serially.
  try {
    await stopAllWorkersAsync()
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[main] stopAllWorkersAsync failed', err)
  }
  stopLlmBridgeServer()
  // Independent try/catch per DB so a throw in one (e.g. better-sqlite3 throws
  // TypeError on double-close) doesn't leak the other handle.
  try {
    closeDatabase()
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[main] closeDatabase failed', err)
  }
  try {
    closeErrorsDb()
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[main] closeErrorsDb failed', err)
  }
  // Now actually quit. Use exit instead of quit — quit re-fires
  // before-quit, which we've guarded but the recursion is unnecessary.
  app.exit(0)
}

// Dev-mode: re-enable default menu accelerators for inspector, etc.
if (!app.isPackaged) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
}

bootstrap().catch((err) => {
  // Any thrown error from bootstrap that wasn't caught by a specific stage
  // wrapper above lands here. fatalStartupAndExit handles the dialog +
  // exit; we still wrap-and-exit for safety in case bootstrap rejects
  // before whenReady (no dialog API yet) or after fatalStartupAndExit's
  // re-throw — whichever happens first.
  if (app.isReady()) {
    fatalStartupAndExit(err, 'application bootstrap')
  } else {
    // eslint-disable-next-line no-console
    console.error('[main] bootstrap failed before app ready', err)
    app.exit(1)
  }
})

export { mainWindow, join }
