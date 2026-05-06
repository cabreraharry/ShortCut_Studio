import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, BellOff } from 'lucide-react'
import { IconButton } from '@/components/ui/icon-button'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { NotificationDrawer } from './NotificationDrawer'

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const qc = useQueryClient()

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.notifications.unreadCount(),
    refetchInterval: 10_000
  })

  const { data: muted = false } = useQuery({
    queryKey: ['notifications', 'mute'],
    queryFn: () => api.notifications.getMute()
  })

  // Live refresh on new notifications — no need to wait for the 10s poll.
  useEffect(() => {
    const unsub = api.notifications.onNew(() => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    })
    return unsub
  }, [qc])

  const Icon = muted ? BellOff : Bell
  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount)

  return (
    <>
      <div className="relative">
        <IconButton
          tip={
            muted
              ? 'Notifications (popups paused)'
              : unreadCount > 0
                ? `${unreadCount} unread notifications`
                : 'Notifications'
          }
          ariaLabel={
            unreadCount > 0
              ? `${unreadCount} unread notifications`
              : 'No unread notifications'
          }
          onClick={() => setOpen(true)}
        >
          <Icon className="h-4 w-4" />
        </IconButton>
        {unreadCount > 0 ? (
          <span
            className={cn(
              'pointer-events-none absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground',
              'ring-2 ring-card'
            )}
          >
            {badgeLabel}
          </span>
        ) : null}
      </div>
      <NotificationDrawer open={open} onOpenChange={setOpen} />
    </>
  )
}
