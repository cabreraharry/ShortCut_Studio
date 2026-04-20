import { app, BrowserWindow, Menu, Tray, nativeImage } from 'electron'
import { join } from 'node:path'

let tray: Tray | null = null

export function createTray(win: BrowserWindow): Tray {
  const iconPath = join(__dirname, '../../resources/icon.ico')
  const image = nativeImage.createFromPath(iconPath)
  tray = new Tray(image)
  tray.setToolTip('SCL Admin')

  const menu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => win.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.quit() } }
  ])

  tray.setContextMenu(menu)
  tray.on('click', () => {
    if (win.isVisible()) win.hide()
    else win.show()
  })

  return tray
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
