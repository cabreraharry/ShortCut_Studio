import { useRef, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ExternalLink,
  FileSearch,
  FileText,
  FileWarning,
  Folder,
  Gauge,
  Search
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useRowSelection } from '@/hooks/use-row-selection'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { toast } from '@/hooks/use-toast'
import { EmptyState } from '@/components/visual/EmptyState'
import { QueryErrorState } from '@/components/visual/QueryErrorState'
import { ColorfulStat } from '@/components/visual/ColorfulStat'
import { SkeletonRows } from '@/components/ui/skeleton'
import type { DocumentInsight, InsightsGroup, InsightsSortKey, SortDirection } from '@shared/types'

const ROW_HEIGHT = 48
const PAGE_SIZE_OPTIONS = [50, 100, 200] as const

export default function InsightsPage(): JSX.Element {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 200)
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null)

  const groupsQuery = useQuery({
    queryKey: ['insights-groups', debouncedSearch],
    queryFn: () => api.insights.groups({ search: debouncedSearch }),
    placeholderData: keepPreviousData
  })
  const { data: groups = [], isLoading: groupsLoading } = groupsQuery

  const overall = aggregateGroups(groups)

  if (groupsQuery.isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Document insights</h1>
        </div>
        <QueryErrorState
          title="Couldn't load insights"
          error={groupsQuery.error as Error}
          onRetry={() => void groupsQuery.refetch()}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Document insights</h1>
        <p className="text-sm text-muted-foreground">
          Extraction quality per file — grouped by source folder. Click a folder to see its files.
          Synthetic data for v1; wires to PDF_Extract when the real pipeline lands.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <ColorfulStat
          label="Average extraction"
          value={`${overall.avgExtractionPct}%`}
          tone="primary"
          icon={<Gauge className="h-4 w-4" />}
        />
        <ColorfulStat
          label="Low-confidence files"
          value={overall.lowConfidenceCount.toLocaleString()}
          sublabel="below 85% extraction"
          tone="warning"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <ColorfulStat
          label="Warnings total"
          value={overall.totalWarnings.toLocaleString()}
          tone="danger"
          icon={<FileWarning className="h-4 w-4" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSearch className="h-4 w-4" />
            Folders
          </CardTitle>
          <CardDescription>
            Click a folder to expand its files. The filter applies across every folder.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by filename across all folders"
              className="pl-7"
            />
          </div>

          {groupsLoading ? (
            <SkeletonRows count={5} />
          ) : groups.length === 0 ? (
            <EmptyState
              variant="search"
              title="No files match"
              description={
                debouncedSearch
                  ? `Nothing matches "${debouncedSearch}". Try a shorter query or clear the filter.`
                  : 'No document insights yet. Run a scan + extraction first.'
              }
            />
          ) : (
            <div className="divide-y divide-border rounded-md border border-border">
              {groups.map((g) => (
                <FolderGroupRow
                  key={g.folder}
                  group={g}
                  expanded={expandedFolder === g.folder}
                  onToggle={() =>
                    setExpandedFolder((cur) => (cur === g.folder ? null : g.folder))
                  }
                  search={debouncedSearch}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function aggregateGroups(groups: InsightsGroup[]): {
  avgExtractionPct: number
  lowConfidenceCount: number
  totalWarnings: number
} {
  let totalFiles = 0
  let weightedExtraction = 0
  let low = 0
  let warn = 0
  for (const g of groups) {
    totalFiles += g.fileCount
    weightedExtraction += g.avgExtractionPct * g.fileCount
    low += g.lowConfidenceCount
    warn += g.totalWarnings
  }
  return {
    avgExtractionPct: totalFiles === 0 ? 0 : Math.round(weightedExtraction / totalFiles),
    lowConfidenceCount: low,
    totalWarnings: warn
  }
}

function FolderGroupRow({
  group,
  expanded,
  onToggle,
  search
}: {
  group: InsightsGroup
  expanded: boolean
  onToggle: () => void
  search: string
}): JSX.Element {
  const pct = group.avgExtractionPct
  const tone = pct >= 90 ? 'bg-emerald-500/70' : pct >= 80 ? 'bg-primary/70' : 'bg-amber-500/70'
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex w-full items-center gap-3 px-4 py-3 text-left text-xs transition-colors hover:bg-accent/40',
          expanded && 'bg-accent/30'
        )}
        aria-expanded={expanded}
      >
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            !expanded && '-rotate-90'
          )}
        />
        <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="truncate text-sm font-medium">{group.folder}</span>
          <span className="text-[10px] text-muted-foreground">
            {group.fileCount.toLocaleString()} files
          </span>
        </div>
        <div className="flex w-40 items-center gap-2">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className={cn('h-full rounded-full', tone)} style={{ width: `${pct}%` }} />
          </div>
          <span className="w-10 text-right font-mono tabular-nums text-muted-foreground">
            {pct}%
          </span>
        </div>
        <span className="w-24 text-right text-muted-foreground">
          <span className="font-mono tabular-nums">{group.lowConfidenceCount}</span> low-conf
        </span>
        <span className="flex w-20 items-center justify-end gap-1 text-muted-foreground">
          {group.totalWarnings > 0 && <AlertTriangle className="h-3 w-3 text-amber-400" />}
          <span className="font-mono tabular-nums">{group.totalWarnings}</span>
        </span>
      </button>
      {expanded && <FolderFileList folder={group.folder} search={search} />}
    </div>
  )
}

function FolderFileList({
  folder,
  search
}: {
  folder: string
  search: string
}): JSX.Element {
  const [pageSize, setPageSize] = useState<number>(100)
  const [offset, setOffset] = useState(0)
  const [sort, setSort] = useState<InsightsSortKey>('name')
  const [sortDir, setSortDir] = useState<SortDirection>('asc')

  const { data, isFetching, isLoading } = useQuery({
    queryKey: ['insights', folder, search, offset, pageSize, sort, sortDir],
    queryFn: () =>
      api.insights.list({ search, folder, offset, limit: pageSize, sort, sortDir }),
    placeholderData: keepPreviousData
  })

  const rows = data?.rows ?? []
  const total = data?.total ?? 0

  const selection = useRowSelection<number>()
  const bulkReveal = (): void => {
    const selectedOnPage = rows.filter((r) => selection.isSelected(r.fileId))
    for (const r of selectedOnPage) void api.system.revealFolder(r.fullPath)
    toast({
      title: `Revealing ${selectedOnPage.length} file${selectedOnPage.length === 1 ? '' : 's'} on this page…`
    })
    selection.clear()
  }

  const toggleSort = (key: InsightsSortKey): void => {
    if (sort === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSort(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
    setOffset(0)
  }

  const pageStart = total === 0 ? 0 : offset + 1
  const pageEnd = Math.min(offset + pageSize, total)
  const atFirstPage = offset === 0
  const atLastPage = pageEnd >= total

  const scrollRef = useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8
  })

  return (
    <div className="space-y-3 border-t border-border/50 bg-muted/10 p-4">
      <div className="flex items-center justify-between gap-3 text-xs">
        {selection.selectedCount > 0 ? (
          <div className="flex flex-1 items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5">
            <span className="font-medium">{selection.selectedCount} selected</span>
            <Button size="sm" variant="outline" className="ml-auto" onClick={bulkReveal}>
              <ExternalLink className="mr-1 h-3 w-3" /> Reveal all
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={selection.clear}
              title="Clear selection across all pages"
            >
              Clear
            </Button>
          </div>
        ) : (
          <span className="text-muted-foreground">
            {total.toLocaleString()} file{total === 1 ? '' : 's'} in <span className="font-medium text-foreground">{folder}</span>
          </span>
        )}
        <div className="flex items-center gap-2">
          <label className="text-muted-foreground">Page size</label>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setOffset(0)
            }}
            className="rounded-md border border-border bg-background px-2 py-1 font-mono"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <SkeletonRows count={6} />
      ) : total === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          No files in this folder match the filter.
        </div>
      ) : (
        <div className={cn('rounded-md border border-border bg-background', isFetching && 'opacity-80')}>
          <SortHeader sort={sort} sortDir={sortDir} onToggle={toggleSort} />
          <div ref={scrollRef} className="max-h-[50vh] overflow-auto">
            <div
              style={{
                height: rowVirtualizer.getTotalSize(),
                width: '100%',
                position: 'relative'
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                const row = rows[virtualItem.index]
                if (!row) return null
                return (
                  <div
                    key={virtualItem.key}
                    data-index={virtualItem.index}
                    className="absolute left-0 top-0 w-full"
                    style={{
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`
                    }}
                  >
                    <InsightRow
                      row={row}
                      selected={selection.isSelected(row.fileId)}
                      onToggleSelect={() => selection.toggle(row.fileId)}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {total > 0 && (
        <div className="flex items-center justify-between gap-3 text-xs">
          <div className="text-muted-foreground">
            Showing{' '}
            <span className="font-mono tabular-nums text-foreground">
              {pageStart.toLocaleString()}–{pageEnd.toLocaleString()}
            </span>{' '}
            of <span className="font-mono tabular-nums text-foreground">{total.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <IconButton
              tip="Previous page"
              className="h-7 w-7"
              disabled={atFirstPage}
              onClick={() => setOffset((o) => Math.max(0, o - pageSize))}
            >
              <ChevronLeft className="h-4 w-4" />
            </IconButton>
            <IconButton
              tip="Next page"
              className="h-7 w-7"
              disabled={atLastPage}
              onClick={() => setOffset((o) => o + pageSize)}
            >
              <ChevronRight className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      )}
    </div>
  )
}

function SortHeader({
  sort,
  sortDir,
  onToggle
}: {
  sort: InsightsSortKey
  sortDir: SortDirection
  onToggle: (key: InsightsSortKey) => void
}): JSX.Element {
  return (
    <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      <span className="h-3.5 w-3.5" aria-hidden />
      <SortButton active={sort === 'name'} dir={sortDir} onClick={() => onToggle('name')} className="flex-1 justify-start">
        File
      </SortButton>
      <SortButton active={sort === 'extraction'} dir={sortDir} onClick={() => onToggle('extraction')} className="w-40 justify-end">
        Extraction
      </SortButton>
      <SortButton active={sort === 'pages'} dir={sortDir} onClick={() => onToggle('pages')} className="w-14 justify-end">
        Pages
      </SortButton>
      <SortButton active={sort === 'warnings'} dir={sortDir} onClick={() => onToggle('warnings')} className="w-14 justify-end">
        Warn
      </SortButton>
      <span className="w-8" aria-hidden />
      <span className="w-8" aria-hidden />
    </div>
  )
}

function SortButton({
  active,
  dir,
  onClick,
  className,
  children
}: {
  active: boolean
  dir: SortDirection
  onClick: () => void
  className?: string
  children: React.ReactNode
}): JSX.Element {
  const Icon = !active ? ChevronsUpDown : dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-foreground',
        active && 'text-foreground',
        className
      )}
    >
      {children}
      <Icon className="h-3 w-3" />
    </button>
  )
}

function InsightRow({
  row,
  selected,
  onToggleSelect
}: {
  row: DocumentInsight
  selected: boolean
  onToggleSelect: () => void
}): JSX.Element {
  const pct = row.extractionPct
  const tone = pct >= 90 ? 'bg-emerald-500/70' : pct >= 80 ? 'bg-primary/70' : 'bg-amber-500/70'
  return (
    <div className={cn('flex h-12 items-center gap-3 border-b border-border/50 px-4 text-xs', selected && 'bg-primary/10')}>
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggleSelect}
        className="h-3.5 w-3.5 cursor-pointer accent-primary"
        aria-label={`Select ${row.fileName}`}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-medium" title={row.fileName}>
          {row.fileName}
        </span>
        <span className="truncate text-[10px] text-muted-foreground" title={row.fullPath}>
          {row.fullPath}
        </span>
      </div>
      <div className="flex w-40 items-center gap-2">
        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className={cn('h-full rounded-full transition-all', tone)} style={{ width: `${pct}%` }} />
        </div>
        <span className="w-10 text-right font-mono tabular-nums text-muted-foreground">{pct}%</span>
      </div>
      <span className="w-14 text-right font-mono tabular-nums text-muted-foreground">
        {row.pageCount} pg
      </span>
      <span className="flex w-14 items-center justify-end gap-1 text-muted-foreground">
        {row.warnings > 0 && <AlertTriangle className="h-3 w-3 text-amber-400" />}
        <span className="font-mono tabular-nums">{row.warnings}</span>
      </span>
      <IconButton
        tip="Open this file"
        onClick={() => void api.system.openFile(row.fullPath)}
      >
        <FileText className="h-4 w-4" />
      </IconButton>
      <IconButton
        tip="Open this file's folder in Windows Explorer"
        onClick={() => void api.system.revealFolder(row.fullPath)}
      >
        <ExternalLink className="h-4 w-4" />
      </IconButton>
    </div>
  )
}
