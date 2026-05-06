import { BrowserWindow, Notification, nativeImage } from 'electron'
import { join } from 'node:path'
import { app } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import type {
  AppNotification,
  NotificationAction,
  NotificationSeverity,
  NotificationSource
} from '@shared/types'
import { getLocAdmDb } from '../db/connection'
import { insert as storeInsert } from './store'

/**
 * Single entry-point for firing a notification. Three side effects:
 *   1. Persist a row in the Notifications table (always — survives restart,
 *      visible in the in-app drawer regardless of mute state).
 *   2. If global mute is OFF and the platform supports OS toasts, show a
 *      Windows toast via Electron's Notification API.
 *   3. Broadcast `notifications:on-new` to all renderers so the bell badge
 *      refreshes immediately without waiting for the 10s poll.
 *
 * Hard contract: notify() never throws. A logging-layer failure must not
 * crash the thing it observes (mirrors errorStore.recordError pattern).
 */

export interface NotifyInput {
  severity: NotificationSeverity
  source: NotificationSource
  title: string
  body?: string | null
  /** Click action — fires when the OS toast is clicked OR when a row is
   *  clicked in the in-app drawer. */
  action?: NotificationAction | null
  /** Set false to skip the OS toast (still recorded + broadcast). Default true. */
  osToast?: boolean
}

let appIcon: Electron.NativeImage | null = null
function getAppIcon(): Electron.NativeImage | null {
  if (appIcon) return appIcon
  try {
    // resources/icon.ico in dev; <resources>/icon.ico in packaged.
    const iconPath = app.isPackaged
      ? join(process.resourcesPath, 'icon.ico')
      : join(__dirname, '../../resources/icon.ico')
    appIcon = nativeImage.createFromPath(iconPath)
    if (appIcon.isEmpty()) appIcon = null
  } catch {
    appIcon = null
  }
  return appIcon
}

export function isMuted(): boolean {
  try {
    const db = getLocAdmDb()
    const row = db
      .prepare('SELECT NotificationsMuted FROM AdminData WHERE RecID = 1')
      .get() as { NotificationsMuted?: number } | undefined
    return (row?.NotificationsMuted ?? 0) === 1
  } catch {
    return false
  }
}

export function setMuted(muted: boolean): void {
  try {
    const db = getLocAdmDb()
    db.prepare('UPDATE AdminData SET NotificationsMuted = ? WHERE RecID = 1').run(
      muted ? 1 : 0
    )
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[notifications] failed to set mute', err)
  }
}

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      try {
        win.webContents.send(channel, payload)
      } catch {
        /* swallow */
      }
    }
  }
}

function showWindowAndSendAction(action: NotificationAction): void {
  const wins = BrowserWindow.getAllWindows()
  const win = wins.find((w) => !w.isDestroyed())
  if (win) {
    if (win.isMinimized()) win.restore()
    if (!win.isVisible()) win.show()
    win.focus()
  }
  broadcast(IpcChannel.NotificationsOnClickAction, action)
}

function fireOsToast(record: AppNotification): void {
  if (!Notification.isSupported()) return
  try {
    const icon = getAppIcon()
    const n = new Notification({
      title: record.title,
      body: record.body ?? '',
      // 'info' severity uses Electron's silent flag so we don't make a sound
      // for low-priority informational events. error/warning fire with sound.
      silent: record.severity === 'info',
      ...(icon ? { icon } : {})
    })
    n.on('click', () => {
      // Always mark read on toast click — the user has acknowledged the event.
      try {
        // Lazy import to avoid a circular store↔dispatch reference.
        import('./store')
          .then((m) => m.markRead(record.id))
          .catch(() => {})
      } catch {
        /* swallow */
      }
      if (record.action) {
        showWindowAndSendAction(record.action)
      } else {
        const wins = BrowserWindow.getAllWindows()
        const win = wins.find((w) => !w.isDestroyed())
        if (win) {
          if (win.isMinimized()) win.restore()
          if (!win.isVisible()) win.show()
          win.focus()
        }
      }
    })
    n.show()
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[notifications] failed to show OS toast', err)
  }
}

export function notify(input: NotifyInput): AppNotification | null {
  try {
    const record = storeInsert({
      severity: input.severity,
      source: input.source,
      title: input.title,
      body: input.body ?? null,
      action: input.action ?? null
    })
    if (!record) return null

    const wantOsToast = input.osToast !== false
    if (wantOsToast && !isMuted()) {
      fireOsToast(record)
    }

    broadcast(IpcChannel.NotificationsOnNew, record)
    return record
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[notifications] notify() failed', err)
    return null
  }
}
