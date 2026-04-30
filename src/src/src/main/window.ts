import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { resolveAppIconPath } from './icon'

let isQuitting = false

export function markQuitting(): void {
  isQuitting = true
}

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    icon: resolveAppIconPath(),
    backgroundColor: '#0b0f19',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // Skip the initial show when the app was auto-launched at login with the
  // --hidden flag (set by the Settings -> Startup toggle). The tray icon stays
  // active so the user can pop the window when they want it.
  const startHidden = process.argv.includes('--hidden')
  if (!startHidden) {
    win.once('ready-to-show', () => win.show())
  }

  // Tray-resident: clicking the X hides instead of destroying so the tray icon
  // still has a live window to toggle. Real teardown happens once before-quit
  // flips isQuitting.
  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      win.hide()
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) {
    win.loadURL(devUrl)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}
