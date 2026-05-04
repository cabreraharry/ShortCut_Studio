import { app, ipcMain } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { IpcChannel } from '@shared/ipc-channels'
import { listDrives } from '../os/drives'
import { listChildren } from '../os/fs-preview'
import type { ShellFolder } from '@shared/types'

// Resolve the user's common Windows shell folders. Used by the Folders
// page's drive picker as one-click shortcuts so the user doesn't have to
// click through 4-5 chevrons to reach Documents. Filtered to entries
// whose target path actually exists — OneDrive is only present when the
// user is signed in.
function resolveShellFolders(): ShellFolder[] {
  const home = app.getPath('home')
  const candidates: ShellFolder[] = [
    { id: 'documents', label: 'Documents', path: app.getPath('documents') },
    { id: 'desktop', label: 'Desktop', path: app.getPath('desktop') },
    { id: 'downloads', label: 'Downloads', path: app.getPath('downloads') },
    // %USERPROFILE%\OneDrive — only present when OneDrive is set up.
    { id: 'onedrive', label: 'OneDrive', path: join(home, 'OneDrive') }
  ]
  return candidates.filter((c) => {
    try {
      return existsSync(c.path)
    } catch {
      return false
    }
  })
}

export function registerDriveHandlers(): void {
  ipcMain.handle(IpcChannel.SystemListDrives, () => listDrives())
  ipcMain.handle(IpcChannel.SystemListChildren, (_evt, path: string) =>
    listChildren(path)
  )
  ipcMain.handle(IpcChannel.SystemShellFolders, () => resolveShellFolders())
}
