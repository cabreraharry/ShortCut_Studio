import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tip } from '@/components/ui/cursor-tooltip'
import type { KnowledgeMapStats, KnowledgeNode } from '@shared/types'

interface ToolbarProps {
  search: string
  onSearchChange: (v: string) => void
  superCategoryId: number | undefined
  onSuperCategoryChange: (id: number | undefined) => void
  superCategories: KnowledgeNode[]   // kind === 'superCategory'
  stats?: KnowledgeMapStats
  onStepPrev: () => void
  onStepNext: () => void
  /** 1-based index of current selection (0 = nothing selected). */
  selectionCurrent: number
  selectionTotal: number
}

export function KnowledgeMapToolbar({
  search,
  onSearchChange,
  superCategoryId,
  onSuperCategoryChange,
  superCategories,
  stats,
  onStepPrev,
  onStepNext,
  selectionCurrent,
  selectionTotal
}: ToolbarProps): JSX.Element {
  const hasNodes = selectionTotal > 0
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card/40 p-3">
      <div className="relative min-w-[200px] flex-1 max-w-sm">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search nodes…"
          className="pl-7"
        />
      </div>
      <div className="flex items-center gap-2 text-xs">
        <label className="text-muted-foreground">Super-category</label>
        <select
          value={superCategoryId ?? ''}
          onChange={(e) =>
            onSuperCategoryChange(e.target.value ? Number(e.target.value) : undefined)
          }
          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
        >
          <option value="">All</option>
          {superCategories.map((sc) => (
            <option
              key={sc.id}
              value={sc.superCategoryId ?? ''}
              disabled={sc.superCategoryId === undefined}
            >
              {sc.label} {sc.topicCount !== undefined ? `· ${sc.topicCount} topics` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Step through every node in order. Wraps at both ends. */}
      <div className="flex items-center gap-1 rounded-md border border-border bg-background/40 p-0.5">
        <Tip content="Previous node">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={onStepPrev}
            disabled={!hasNodes}
            aria-label="Previous node"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
        </Tip>
        <div className="min-w-[64px] px-1 text-center font-mono text-[11px] tabular-nums text-muted-foreground">
          {hasNodes ? `${selectionCurrent || '—'} / ${selectionTotal}` : '— / —'}
        </div>
        <Tip content="Next node">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={onStepNext}
            disabled={!hasNodes}
            aria-label="Next node"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </Tip>
      </div>

      {stats && (
        <div className="ml-auto flex items-center gap-3 text-[10px] text-muted-foreground">
          <StatChip
            dotClass="bg-glass-local"
            label={`${stats.totalSuperCategories} super-cats`}
          />
          <StatChip dotClass="bg-primary" label={`${stats.totalTopics} topics`} />
          <StatChip
            dotClass="bg-glass-peer"
            label={`${stats.totalFiles.toLocaleString()} files`}
          />
        </div>
      )}
    </div>
  )
}

function StatChip({ dotClass, label }: { dotClass: string; label: string }): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {label}
    </span>
  )
}
