import { app, BrowserWindow, Menu, Tray, nativeImage } from 'electron'
import { resolveAppIconPath } from './icon'

let tray: Tray | null = null

export function createTray(win: BrowserWindow): Tray {
  const iconPath = resolveAppIconPath()
  // Windows 11 tray slots render at ~16x16 (HiDPI may go to 24x24 / 32x32).
  // Our .ico ships PNG-encoded entries from 16x16 to 256x256; Electron's
  // NativeImage occasionally selects an oversized entry which the tray can't
  // render, leaving the slot visibly blank. Force-resize to 16x16 so we always
  // get a tray-sized bitmap.
  const raw = nativeImage.createFromPath(iconPath)
  const image = raw.isEmpty()
    ? raw
    : raw.resize({ width: 16, height: 16, quality: 'best' })

  if (image.isEmpty()) {
    console.warn(
      `[tray] icon at ${iconPath} produced an empty NativeImage — tray slot will appear blank. ` +
        `Check that the .ico exists and is readable.`
    )
  }

  tray = new Tray(image)
  tray.setToolTip('ShortCut Studio')

  const menu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        if (win.isDestroyed()) return
        win.show()
        win.focus()
      }
    },
    {
      label: 'Hide to tray',
      click: () => {
        if (win.isDestroyed()) return
        win.hide()
      }
    },
    { type: 'separator' },
    { label: 'Quit ShortCut Studio', click: () => { app.quit() } }
  ])

  tray.setContextMenu(menu)
  tray.on('click', () => {
    if (win.isDestroyed()) return
    if (win.isVisible() && win.isFocused()) {
      win.hide()
    } else {
      win.show()
      win.focus()
    }
  })
  // Double-click also restores — common Windows expectation for tray apps.
  tray.on('double-click', () => {
    if (win.isDestroyed()) return
    win.show()
    win.focus()
  })

  return tray
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
