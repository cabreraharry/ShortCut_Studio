import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AppNotification, NotificationSeverity } from '@shared/types'

interface Props {
  notification: AppNotification
  onClick: () => void
  onDismiss: () => void
}

const SEVERITY_ICON: Record<NotificationSeverity, typeof AlertCircle> = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info
}

const SEVERITY_TEXT_CLASS: Record<NotificationSeverity, string> = {
  error: 'text-destructive',
  warning: 'text-amber-500 dark:text-amber-400',
  info: 'text-sky-500 dark:text-sky-400'
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`
  return `${Math.round(diff / 86_400_000)}d ago`
}

export function NotificationItem({ notification, onClick, onDismiss }: Props) {
  const Icon = SEVERITY_ICON[notification.severity]
  const isUnread = notification.readAt == null
  return (
    <div
      className={cn(
        'group relative flex gap-3 border-b border-border px-4 py-3 transition-colors',
        notification.action ? 'cursor-pointer hover:bg-accent/40' : '',
        isUnread ? 'bg-accent/20' : 'bg-transparent'
      )}
      onClick={notification.action ? onClick : undefined}
      role={notification.action ? 'button' : undefined}
      tabIndex={notification.action ? 0 : -1}
      onKeyDown={(e) => {
        if (notification.action && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <Icon
        className={cn(
          'h-4 w-4 shrink-0 mt-0.5',
          SEVERITY_TEXT_CLASS[notification.severity]
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className={cn(
              'truncate text-sm',
              isUnread ? 'font-semibold text-foreground' : 'font-normal text-foreground/80'
            )}
            title={notification.title}
          >
            {notification.title}
          </p>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {relativeTime(notification.ts)}
          </span>
        </div>
        {notification.body ? (
          <p
            className="mt-0.5 text-xs leading-snug text-muted-foreground"
            title={notification.body}
          >
            {notification.body}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        className="absolute right-2 top-2 rounded p-1 opacity-0 transition-opacity hover:bg-accent/60 group-hover:opacity-100 focus:opacity-100"
        onClick={(e) => {
          e.stopPropagation()
          onDismiss()
        }}
        aria-label="Dismiss notification"
        title="Dismiss"
      >
        <X className="h-3 w-3 text-muted-foreground" />
      </button>
    </div>
  )
}
