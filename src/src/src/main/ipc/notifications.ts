import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import type { NotificationListQuery } from '@shared/types'
import {
  dismiss as dismissNotification,
  getUnreadCount,
  list as listNotifications,
  markRead
} from '../notifications/store'
import { isMuted, notify, setMuted } from '../notifications/dispatch'

export function registerNotificationHandlers(): void {
  ipcMain.handle(
    IpcChannel.NotificationsList,
    (_evt, query?: NotificationListQuery) => listNotifications(query ?? {})
  )

  ipcMain.handle(IpcChannel.NotificationsMarkRead, (_evt, id: number | 'all') => {
    if (id !== 'all' && (typeof id !== 'number' || !Number.isFinite(id))) {
      throw new Error("VALIDATION: id must be a number or 'all'")
    }
    markRead(id)
    return { ok: true }
  })

  ipcMain.handle(IpcChannel.NotificationsDismiss, (_evt, id: number | 'all') => {
    if (id !== 'all' && (typeof id !== 'number' || !Number.isFinite(id))) {
      throw new Error("VALIDATION: id must be a number or 'all'")
    }
    return dismissNotification(id)
  })

  ipcMain.handle(IpcChannel.NotificationsUnreadCount, () => getUnreadCount())

  ipcMain.handle(IpcChannel.NotificationsGetMute, () => isMuted())

  ipcMain.handle(IpcChannel.NotificationsSetMute, (_evt, muted: boolean) => {
    setMuted(Boolean(muted))
    return { muted: isMuted() }
  })

  // Fires a sample so the user can confirm Windows is showing OS toasts. The
  // first time the app fires a Notification on Windows, the OS may suppress
  // it pending the user enabling toasts for ShortCut Studio in Settings →
  // System → Notifications. This button surfaces the issue immediately
  // instead of "I waited an hour for a worker to crash and saw nothing."
  ipcMain.handle(IpcChannel.NotificationsTest, () => {
    return notify({
      severity: 'info',
      source: 'main',
      title: 'Test notification',
      body: 'If you see this in Windows, OS toasts are working.',
      action: { kind: 'navigate', target: '/settings#notifications' }
    })
  })
}
