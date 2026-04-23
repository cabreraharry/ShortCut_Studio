import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronRight,
  HardDrive,
  Folder,
  FolderPlus,
  FolderMinus,
  Loader2,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { FolderRow, FsEntry } from '@shared/types'

function formatBytes(n: number): string {
  if (!n) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = n
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`
}

export type NodeState =
  | 'included'
  | 'excluded'
  | 'included-inherited'
  | 'excluded-inherited'
  | null

function normalizePath(p: string): string {
  return p.replace(/[\\/]+$/, '').toLowerCase()
}

function isDescendantOf(child: string, parent: string): boolean {
  const c = normalizePath(child)
  const p = normalizePath(parent)
  if (c === p) return false
  const prefix = p + (p.endsWith(':') ? '\\' : '\\')
  return c.startsWith(prefix)
}

function deriveState(
  path: string,
  folders: FolderRow[]
): NodeState {
  // Exact-match folders win over ancestors.
  const match = folders.find((f) => normalizePath(f.path) === normalizePath(path))
  if (match) return match.include === 'Y' ? 'included' : 'excluded'

  // Find the closest ancestor in the folders list. Exclude ancestors beat
  // include ancestors (matches FoldersPage rule: 'orange rows win').
  let best: FolderRow | null = null
  for (const f of folders) {
    if (isDescendantOf(path, f.path)) {
      if (!best) {
        best = f
        continue
      }
      const bestLen = best.path.length
      const curLen = f.path.length
      if (curLen > bestLen) best = f
      else if (curLen === bestLen && f.include === 'N') best = f
    }
  }
  if (!best) return null
  return best.include === 'Y' ? 'included-inherited' : 'excluded-inherited'
}

const STATE_TINT: Record<NonNullable<NodeState>, string> = {
  included: 'border-l-2 border-emerald-500 bg-emerald-500/10',
  excluded: 'border-l-2 border-amber-700 bg-amber-700/10',
  'included-inherited': 'border-l-2 border-emerald-500/50 bg-emerald-500/5',
  'excluded-inherited': 'border-l-2 border-amber-700/50 bg-amber-700/5'
}

export interface DriveTreeProps {
  onPick: (path: string, action: 'include' | 'exclude') => void
  onPickMany?: (paths: string[], action: 'include' | 'exclude') => void
  folders?: FolderRow[]
}

export function DriveTree({ onPick, onPickMany, folders = [] }: DriveTreeProps): JSX.Element {
  const { data: drives = [], isLoading } = useQuery({
    queryKey: ['drives'],
    queryFn: () => api.system.listDrives()
  })
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const foldersByPath = useMemo(
    () => new Map(folders.map((f) => [normalizePath(f.path), f])),
    [folders]
  )

  const toggleSelect = (path: string, ctrl: boolean): void => {
    setSelected((prev) => {
      if (!ctrl) return new Set([path])
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const clearSelection = (): void => setSelected(new Set())

  const applyToSelected = (action: 'include' | 'exclude'): void => {
    const paths = Array.from(selected)
    if (paths.length === 0) return
    if (onPickMany) onPickMany(paths, action)
    else for (const p of paths) onPick(p, action)
    clearSelection()
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Scanning drives…
      </div>
    )
  }
  if (drives.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">No drives found.</p>
  }

  return (
    <div>
      {selected.size > 0 && (
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-primary/10 px-2 py-1.5 text-xs backdrop-blur">
          <span className="font-semibold">
            {selected.size} selected
          </span>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto h-6 gap-1 px-2 text-[10px]"
            onClick={() => applyToSelected('include')}
          >
            <FolderPlus className="h-3 w-3" /> Include {selected.size}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-6 gap-1 px-2 text-[10px]"
            onClick={() => applyToSelected('exclude')}
          >
            <FolderMinus className="h-3 w-3" /> Exclude {selected.size}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1 px-2 text-[10px]"
            onClick={clearSelection}
          >
            <X className="h-3 w-3" /> Clear
          </Button>
        </div>
      )}
      <div className="space-y-0.5 p-1">
        {drives.map((d) => {
          const path = `${d.letter}:\\`
          return (
            <TreeNode
              key={d.letter}
              path={path}
              label={`${d.label}  ${formatBytes(d.freeBytes)} free / ${formatBytes(d.totalBytes)}`}
              depth={0}
              isDrive
              onPick={onPick}
              selected={selected}
              onToggleSelect={toggleSelect}
              foldersByPath={foldersByPath}
              folders={folders}
            />
          )
        })}
      </div>
      {folders.length > 0 && (
        <div className="flex items-center gap-3 border-t border-border/50 bg-muted/20 px-3 py-1.5 text-[10px] text-muted-foreground">
          <Legend color="bg-emerald-500" label="Included" />
          <Legend color="bg-amber-700" label="Excluded" />
          <span className="ml-auto italic">Ctrl+click to multi-select · plain click replaces selection</span>
        </div>
      )}
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('inline-block h-2 w-2 rounded-sm', color)} />
      {label}
    </span>
  )
}

interface TreeNodeProps {
  path: string
  label: string
  depth: number
  isDrive?: boolean
  entry?: FsEntry
  onPick: (path: string, action: 'include' | 'exclude') => void
  selected: Set<string>
  onToggleSelect: (path: string, ctrl: boolean) => void
  foldersByPath: Map<string, FolderRow>
  folders: FolderRow[]
}

function TreeNode({
  path,
  label,
  depth,
  isDrive,
  entry,
  onPick,
  selected,
  onToggleSelect,
  foldersByPath,
  folders
}: TreeNodeProps): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const { data: children = [], isLoading } = useQuery({
    queryKey: ['fs', path],
    queryFn: () => api.system.listChildren(path),
    enabled: expanded
  })

  const state = deriveState(path, folders)
  const isSelected = selected.has(path)
  const Icon = isDrive ? HardDrive : Folder

  return (
    <div>
      <div
        className={cn(
          'group relative flex items-center gap-1 rounded px-1 py-0.5 text-xs hover:bg-accent/40',
          state && STATE_TINT[state],
          isSelected && 'ring-1 ring-primary/60'
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={(e) => {
          // Ignore clicks that came from the chevron/include/exclude buttons.
          const target = e.target as HTMLElement
          if (target.closest('[data-tree-action]')) return
          onToggleSelect(path, e.ctrlKey || e.metaKey)
        }}
      >
        <button
          type="button"
          data-tree-action="expand"
          onClick={(e) => {
            e.stopPropagation()
            setExpanded((v) => !v)
          }}
          className="flex flex-1 items-center gap-1.5 text-left"
        >
          <ChevronRight
            className={cn('h-3 w-3 text-muted-foreground transition-transform', expanded && 'rotate-90')}
          />
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="truncate font-mono">{label}</span>
          {entry?.fileCount !== undefined && (
            <span className="ml-1 text-[10px] text-muted-foreground">· {entry.fileCount}</span>
          )}
          {state === 'included' && (
            <span className="ml-1 text-[9px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              included
            </span>
          )}
          {state === 'excluded' && (
            <span className="ml-1 text-[9px] uppercase tracking-wider text-amber-700 dark:text-amber-400">
              excluded
            </span>
          )}
        </button>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100" data-tree-action="include-exclude">
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[10px]"
            onClick={(e) => {
              e.stopPropagation()
              onPick(path, 'include')
            }}
            title="Include this folder"
          >
            <FolderPlus className="mr-1 h-3 w-3" /> Include
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[10px]"
            onClick={(e) => {
              e.stopPropagation()
              onPick(path, 'exclude')
            }}
            title="Exclude this folder"
          >
            <FolderMinus className="mr-1 h-3 w-3" /> Exclude
          </Button>
        </div>
      </div>
      {expanded && (
        <div>
          {isLoading ? (
            <div
              className="flex items-center gap-2 py-1 text-[10px] text-muted-foreground"
              style={{ paddingLeft: `${(depth + 1) * 12 + 4}px` }}
            >
              <Loader2 className="h-3 w-3 animate-spin" /> Listing…
            </div>
          ) : children.length === 0 ? (
            <div
              className="py-1 text-[10px] italic text-muted-foreground"
              style={{ paddingLeft: `${(depth + 1) * 12 + 4}px` }}
            >
              (empty)
            </div>
          ) : (
            children.map((c) => (
              <TreeNode
                key={c.path}
                path={c.path}
                label={c.name}
                depth={depth + 1}
                entry={c}
                onPick={onPick}
                selected={selected}
                onToggleSelect={onToggleSelect}
                foldersByPath={foldersByPath}
                folders={folders}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
