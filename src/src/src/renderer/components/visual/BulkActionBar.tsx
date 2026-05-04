import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Selection-aware action bar surfaced when one or more rows are checked.
// Used by Folders (Folder rows) and the Browse-Drives DriveTree (drive
// nodes) so the same chrome appears everywhere. Sticky variant pins to
// the top of a scroll container; default sits inline.

export interface BulkAction {
  key: string
  label: string
  icon?: JSX.Element
  variant?: 'default' | 'outline' | 'ghost'
  onClick: () => void
  disabled?: boolean
}

export function BulkActionBar({
  count,
  actions,
  onClear,
  sticky = false,
  className
}: {
  count: number
  actions: BulkAction[]
  onClear: () => void
  sticky?: boolean
  className?: string
}): JSX.Element | null {
  if (count <= 0) return null
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs',
        sticky && 'sticky top-0 z-10 backdrop-blur',
        className
      )}
    >
      <span className="font-semibold">{count} selected</span>
      <div className="ml-auto flex items-center gap-2">
        {actions.map((a) => (
          <Button
            key={a.key}
            size="sm"
            variant={a.variant ?? 'outline'}
            onClick={a.onClick}
            disabled={a.disabled}
          >
            {a.icon}
            {a.label}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={onClear}>
          <X className="mr-1 h-3 w-3" />
          Clear
        </Button>
      </div>
    </div>
  )
}
