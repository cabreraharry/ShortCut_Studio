import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { BellOff, Bell, CheckCheck, Trash2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { api } from '@/lib/api'
import type { AppNotification } from '@shared/types'
import { NotificationItem } from './NotificationItem'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NotificationDrawer({ open, onOpenChange }: Props) {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => api.notifications.list({ limit: 50 }),
    refetchInterval: open ? 5000 : false,
    enabled: open
  })

  const { data: muted = false } = useQuery({
    queryKey: ['notifications', 'mute'],
    queryFn: () => api.notifications.getMute()
  })

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['notifications'] })
  }

  const markRead = useMutation({
    mutationFn: (id: number | 'all') => api.notifications.markRead(id),
    onSuccess: invalidateAll
  })
  const dismiss = useMutation({
    mutationFn: (id: number | 'all') => api.notifications.dismiss(id),
    onSuccess: invalidateAll
  })
  const setMute = useMutation({
    mutationFn: (next: boolean) => api.notifications.setMute(next),
    onSuccess: invalidateAll
  })

  const rows: AppNotification[] = useMemo(() => data?.rows ?? [], [data])

  const handleClick = (n: AppNotification) => {
    markRead.mutate(n.id)
    if (n.action?.kind === 'navigate' && n.action.target) {
      const target = n.action.target
      // Hash-router-friendly: split path + anchor.
      const hashIdx = target.indexOf('#')
      if (hashIdx >= 0) {
        const path = target.slice(0, hashIdx)
        navigate(path)
        // Defer scroll-into-view until the page mounts.
        const anchor = target.slice(hashIdx + 1)
        setTimeout(() => {
          const el = document.getElementById(anchor)
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 100)
      } else {
        navigate(target)
      }
      onOpenChange(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-sm">
        <SheetHeader className="space-y-2 border-b border-border bg-card/60 px-4 py-3">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base">Notifications</SheetTitle>
            <button
              type="button"
              onClick={() => setMute.mutate(!muted)}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent/60"
              title={muted ? 'OS toasts muted — click to unmute' : 'Mute OS toasts'}
            >
              {muted ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
              {muted ? 'Muted' : 'Mute'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => markRead.mutate('all')}
              disabled={!data?.unreadCount}
              className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent/60 disabled:opacity-50"
            >
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </button>
            <button
              type="button"
              onClick={() => dismiss.mutate('all')}
              disabled={!rows.length}
              className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent/60 disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" />
              Clear all
            </button>
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No notifications yet.</p>
              <p className="max-w-xs text-xs text-muted-foreground/70">
                Worker crashes, LLM provider errors, update events, and missing
                folders will show up here.
              </p>
            </div>
          ) : (
            rows.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onClick={() => handleClick(n)}
                onDismiss={() => dismiss.mutate(n.id)}
              />
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
