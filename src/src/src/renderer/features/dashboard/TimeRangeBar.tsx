import { cn } from '@/lib/utils'
import type { TimeRange } from '@shared/types'

const RANGES: { value: TimeRange; label: string }[] = [
  { value: '12h', label: '12h' },
  { value: '24h', label: '24h' },
  { value: '2d', label: '2d' },
  { value: '5d', label: '5d' },
  { value: '10d', label: '10d' },
  { value: 'all', label: 'All' }
]

export function TimeRangeBar({
  value,
  onChange
}: {
  value: TimeRange
  onChange: (next: TimeRange) => void
}) {
  return (
    <div className="inline-flex items-center rounded-md border border-border bg-muted/30 p-0.5 text-xs">
      {RANGES.map((r) => (
        <button
          key={r.value}
          type="button"
          onClick={() => onChange(r.value)}
          className={cn(
            'rounded px-3 py-1 transition-colors',
            value === r.value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
