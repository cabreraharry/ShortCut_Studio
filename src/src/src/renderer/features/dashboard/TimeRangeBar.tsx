import { cn } from '@/lib/utils'
import type { TimeRange } from '@shared/types'

const RANGES: { value: TimeRange; label: string }[] = [
  { value: '5h', label: '5h' },
  { value: '1d', label: '1d' },
  { value: '3d', label: '3d' },
  { value: '5d', label: '5d' }
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
