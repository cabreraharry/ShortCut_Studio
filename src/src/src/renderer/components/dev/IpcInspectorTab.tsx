import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useDevModeStore, type IpcEvent } from '@/stores/devMode'
import { cn } from '@/lib/utils'

export function IpcInspectorTab(): JSX.Element {
  const events = useDevModeStore((s) => s.events)
  const paused = useDevModeStore((s) => s.paused)
  const setPaused = useDevModeStore((s) => s.setPaused)
  const clearEvents = useDevModeStore((s) => s.clearEvents)
  const [filter, setFilter] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const q = filter.trim().toLowerCase()
  const filtered = q ? events.filter((e) => e.label.toLowerCase().includes(q)) : events
  // Newest first
  const sorted = [...filtered].reverse()

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter channel…"
          className="h-7 flex-1 rounded-md border border-border/60 bg-muted/30 px-2 text-xs outline-none focus:border-primary"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => setPaused(!paused)}
          className={cn(paused && 'bg-amber-500/20 text-amber-800 dark:text-amber-400')}
        >
          {paused ? 'Resume' : 'Pause'}
        </Button>
        <Button size="sm" variant="outline" onClick={clearEvents}>
          Clear
        </Button>
      </div>

      <div className="text-[10px] text-muted-foreground">
        {events.length}/500 captured{paused ? ' · paused' : ''} ·{' '}
        <span title="Event-stream methods (onClassifyProgress / onStorybookLog / onToggle) aren't logged here.">
          invoke-style only
        </span>
      </div>

      <div className="space-y-1">
        {sorted.length === 0 && (
          <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-center text-xs text-muted-foreground">
            {events.length === 0
              ? 'No IPC events yet. Navigate the app to capture calls.'
              : 'No events match that filter.'}
          </div>
        )}
        {sorted.map((e) => (
          <EventRow
            key={e.id}
            event={e}
            expanded={expandedId === e.id}
            onToggle={() => setExpandedId(expandedId === e.id ? null : e.id)}
          />
        ))}
      </div>
    </div>
  )
}

function EventRow({
  event,
  expanded,
  onToggle
}: {
  event: IpcEvent
  expanded: boolean
  onToggle: () => void
}): JSX.Element {
  const error = !!event.error
  return (
    <div
      className={cn(
        'rounded border border-border/60 bg-muted/20 text-xs transition-colors',
        error && 'border-destructive/40 bg-destructive/10'
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-accent/40"
      >
        <span className="w-10 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
          {event.durationMs}ms
        </span>
        <span className="flex-1 truncate font-mono">{event.label}</span>
        {error ? (
          <span className="shrink-0 font-mono text-[10px] text-destructive">err</span>
        ) : (
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
            {formatSize(event.resultSize)}
          </span>
        )}
      </button>
      {expanded && (
        <div className="space-y-1 border-t border-border/60 px-2 py-2 font-mono text-[10px]">
          <div className="text-muted-foreground">
            {new Date(event.ts).toLocaleTimeString()}
          </div>
          {event.args.length > 0 ? (
            event.args.map((a, i) => (
              <div key={i} className="break-all">
                <span className="text-muted-foreground">arg[{i}]:</span> {a}
              </div>
            ))
          ) : (
            <div className="text-muted-foreground">(no args)</div>
          )}
          {event.error && (
            <div className="break-all text-destructive">error: {event.error}</div>
          )}
        </div>
      )}
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`
  return `${(bytes / 1024 / 1024).toFixed(1)}M`
}
