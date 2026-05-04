import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronRight,
  HardDrive,
  Folder,
  FolderPlus,
  FolderMinus,
  Loader2,
  FileText,
  Cloud,
  Monitor,
  Download
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BulkActionBar } from '@/components/visual/BulkActionBar'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { FolderRow, FsEntry, ShellFolder } from '@shared/types'

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
  const { data: shellFolders = [] } = useQuery({
    queryKey: ['shellFolders'],
    queryFn: () => api.system.shellFolders()
  })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Hoist expanded state up so quick-pick shortcuts can drive it. Without
  // this each TreeNode owned its own state and the user had to walk the
  // tree manually after every shortcut click.
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

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

  // The expanded Set always stores normalised (lowercase, no trailing
  // slash) keys. TreeNode looks up against the same normalisation. Storing
  // mixed-case keys would let the same node end up in the Set twice —
  // once via expandAncestors (lowercase) and once via the chevron click
  // path (raw, e.g. 'C:\\') — and the chevron click would only remove
  // one of them, leaving the node permanently expanded.
  const toggleExpand = (path: string): void => {
    const key = normalizePath(path)
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Walk back up the tree expanding every ancestor so a shortcut for
  // C:\Users\<me>\Documents reveals the path even if the drive node has
  // never been opened.
  const expandAncestors = (path: string): void => {
    const parts: string[] = []
    let cursor = normalizePath(path)
    while (cursor.length > 0) {
      parts.push(cursor)
      const idx = cursor.lastIndexOf('\\')
      if (idx <= 2) {
        // Drive root like 'c:' — keep the normalised form for the Set so
        // it agrees with toggleExpand's keying.
        break
      }
      cursor = cursor.slice(0, idx)
    }
    setExpanded((prev) => {
      const next = new Set(prev)
      for (const p of parts) next.add(p)
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
        <BulkActionBar
          count={selected.size}
          sticky
          onClear={clearSelection}
          actions={[
            {
              key: 'include',
              label: `Include ${selected.size}`,
              icon: <FolderPlus className="mr-1 h-3 w-3" />,
              onClick: () => applyToSelected('include')
            },
            {
              key: 'exclude',
              label: `Exclude ${selected.size}`,
              icon: <FolderMinus className="mr-1 h-3 w-3" />,
              onClick: () => applyToSelected('exclude')
            }
          ]}
          className="rounded-none"
        />
      )}

      {/* Quick-pick shortcuts. Saves users from chevron-walking 4 levels deep
          to reach Documents / Desktop / Downloads. We hide the strip
          entirely when the OS doesn't surface any of these (e.g. on a
          stripped Windows install). */}
      {shellFolders.length > 0 && (
        <ShellFolderShortcuts
          folders={shellFolders}
          onJump={(p) => {
            expandAncestors(p)
            // Highlight the destination so the user can immediately
            // see where the tree just opened to.
            setSelected(new Set([p]))
          }}
        />
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
              expanded={expanded}
              onToggleExpand={toggleExpand}
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
          <span className="ml-auto italic">
            Click a row to expand · Ctrl+click to multi-select
          </span>
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

function ShellFolderShortcuts({
  folders,
  onJump
}: {
  folders: ShellFolder[]
  onJump: (path: string) => void
}): JSX.Element {
  const iconFor = (id: ShellFolder['id']): JSX.Element => {
    switch (id) {
      case 'documents':
        return <FileText className="h-3 w-3" />
      case 'desktop':
        return <Monitor className="h-3 w-3" />
      case 'downloads':
        return <Download className="h-3 w-3" />
      case 'onedrive':
        return <Cloud className="h-3 w-3" />
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-border/50 bg-muted/10 px-2 py-1.5">
      <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Shortcuts
      </span>
      {folders.map((f) => (
        <Button
          key={f.id}
          size="sm"
          variant="outline"
          className="h-6 gap-1 px-2 text-[10px]"
          onClick={() => onJump(f.path)}
          title={f.path}
        >
          {iconFor(f.id)}
          {f.label}
        </Button>
      ))}
    </div>
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
  expanded: Set<string>
  onToggleExpand: (path: string) => void
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
  expanded,
  onToggleExpand,
  foldersByPath,
  folders
}: TreeNodeProps): JSX.Element {
  // The Set stores normalised keys exclusively (toggleExpand normalises
  // before insert) so the lookup is single-form too. Avoids the duplicate
  // key bug that otherwise lets a single node end up in the Set twice.
  const isExpanded = expanded.has(normalizePath(path))
  const { data: children = [], isLoading } = useQuery({
    queryKey: ['fs', path],
    queryFn: () => api.system.listChildren(path),
    enabled: isExpanded
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
          // Match Windows Explorer / VS Code: row click expands; modifier
          // clicks add to a multi-selection. Selection is still possible
          // via Ctrl+click; the previous "row toggles selection, chevron
          // toggles expansion" model required two clicks to reach the
          // most common task on this tree.
          if (e.ctrlKey || e.metaKey || e.shiftKey) {
            onToggleSelect(path, true)
          } else {
            onToggleExpand(path)
          }
        }}
      >
        <button
          type="button"
          data-tree-action="expand"
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpand(path)
          }}
          // Bigger hit area for the chevron — at default DPI the previous
          // h-3 w-3 was a ~6 px target after padding. The visible glyph
          // stays small but the tap region is now h-6 wide.
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-accent/60"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          <ChevronRight
            className={cn('h-3 w-3 text-muted-foreground transition-transform', isExpanded && 'rotate-90')}
          />
        </button>
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate font-mono">{label}</span>
        {entry?.fileCount !== undefined && (
          <span className="text-[10px] text-muted-foreground">· {entry.fileCount}</span>
        )}
        {state === 'included' && (
          <span className="text-[9px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            included
          </span>
        )}
        {state === 'excluded' && (
          <span className="text-[9px] uppercase tracking-wider text-amber-700 dark:text-amber-400">
            excluded
          </span>
        )}
        {/* Always-visible action buttons. Hover-only affordances kept the
            page hostile to keyboard / touch users and meant a brand-new
            user saw zero verbs in the picker. */}
        <div className="flex shrink-0 gap-0.5" data-tree-action="include-exclude">
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
      {isExpanded && (
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
                expanded={expanded}
                onToggleExpand={onToggleExpand}
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
