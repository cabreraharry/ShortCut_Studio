import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Trash2, Pencil, Check, X, Search, ExternalLink, ShieldCheck, ArrowRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { HelpHint } from '@/components/ui/help-hint'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { useRowSelection } from '@/hooks/use-row-selection'
import { ErrorDialog } from '@/components/ui/error-dialog'
import { DriveTree } from '@/components/drive-tree/DriveTree'
import { EmptyState } from '@/components/visual/EmptyState'
import { BulkActionBar } from '@/components/visual/BulkActionBar'
import { QueryErrorState } from '@/components/visual/QueryErrorState'
import { SkeletonRows } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { HardDrive } from 'lucide-react'
import type { FolderRow, FileTypeFilter } from '@shared/types'

function errMsg(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

function isValidationError(err: unknown): boolean {
  return err instanceof Error && err.message.includes('VALIDATION:')
}

function cleanValidationMessage(err: unknown, fallback: string): string {
  const msg = errMsg(err, fallback)
  return msg.replace(/^.*VALIDATION:\s*/, '')
}

export default function FoldersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Folders</h1>
        <p className="text-sm text-muted-foreground">
          Decide which directories get scanned and which to exclude. Pick the file types that count as scannable content.
        </p>
      </div>
      {/* FoldersCard first: a brand-new user (zero folders configured) hits
          this page and the empty-state CTA "Browse drives" needs to be the
          first thing they see, not the FileTypes chips below. */}
      <FoldersCard />
      <FileTypesCard />
      <PrivacyTeaser />
    </div>
  )
}

function PrivacyTeaser(): JSX.Element {
  const navigate = useNavigate()
  return (
    <Card
      className="group relative cursor-pointer overflow-hidden border-rose-500/30 bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent transition-colors hover:border-rose-500/50"
      onClick={() => navigate('/privacy')}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-rose-500/15 blur-2xl transition-all group-hover:scale-110"
      />
      <CardContent className="relative flex items-center gap-4 p-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-500/15 transition-transform group-hover:scale-110 group-hover:-rotate-6">
          <ShieldCheck className="h-6 w-6 text-rose-600 dark:text-rose-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">
            Some folders too sensitive for the network?
          </div>
          <div className="text-xs text-muted-foreground">
            Set up private terms so matching files route to the Private library and never leave your machine.
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 text-rose-600 group-hover:bg-rose-500/10 dark:text-rose-400"
          onClick={(e) => {
            e.stopPropagation()
            navigate('/privacy')
          }}
        >
          Set up privacy terms
          <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </Button>
      </CardContent>
    </Card>
  )
}

// Extensions where the UI shows the chip as greyed/disabled because the
// extraction pipeline doesn't handle them yet. Purely client-side — DB state
// for these is preserved in case they get enabled in a future milestone.
const UNSUPPORTED_EXTENSIONS = new Set<string>(['.mobi'])

function FileTypesCard() {
  const qc = useQueryClient()
  const { data: types = [] } = useQuery({
    queryKey: ['fileTypes'],
    queryFn: () => api.fileTypes.list()
  })
  const toggle = useMutation({
    mutationFn: ({ ext, enabled }: { ext: string; enabled: boolean }) =>
      api.fileTypes.toggle(ext, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fileTypes'] }),
    onError: (err) => toast({ title: errMsg(err, 'Failed to toggle file type'), variant: 'destructive' })
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          File types
          <HelpHint
            size="sm"
            label="Global on/off list of file extensions the scanner considers. Disabled types are skipped during scanning. The toggle is global — there's no per-folder override yet."
          />
        </CardTitle>
        <CardDescription>
          Click a chip to toggle whether the scanner picks up files of that type.
          Greyed chips aren&apos;t supported yet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {types.map((t) => (
            <FileTypeChip
              key={t.extension}
              filter={t}
              unsupported={UNSUPPORTED_EXTENSIONS.has(t.extension.toLowerCase())}
              onToggle={(enabled) =>
                toggle.mutate({ ext: t.extension, enabled })
              }
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function FileTypeChip({
  filter,
  unsupported,
  onToggle
}: {
  filter: FileTypeFilter
  unsupported: boolean
  onToggle: (enabled: boolean) => void
}) {
  const chip = (
    <button
      type="button"
      onClick={() => !unsupported && onToggle(!filter.enabled)}
      disabled={unsupported}
      className={cn(
        'inline-flex items-center gap-2 rounded-md border px-3 py-1 text-xs font-medium transition-colors',
        unsupported
          ? 'cursor-not-allowed border-dashed border-border/60 bg-muted/20 text-muted-foreground/70 opacity-60'
          : filter.enabled
            ? 'border-primary/40 bg-primary/15 text-foreground hover:bg-primary/25'
            : 'border-border bg-transparent text-muted-foreground hover:bg-accent/40'
      )}
    >
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          unsupported
            ? 'bg-muted-foreground/30'
            : filter.enabled
              ? 'bg-primary'
              : 'bg-muted-foreground/40'
        )}
      />
      {filter.label}
      <span className="text-muted-foreground">{filter.extension}</span>
    </button>
  )

  if (!unsupported) return chip

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-not-allowed">{chip}</span>
      </TooltipTrigger>
      <TooltipContent>{filter.extension.toUpperCase()} support is coming soon — extractor not wired yet.</TooltipContent>
    </Tooltip>
  )
}

function FoldersCard() {
  const qc = useQueryClient()
  const foldersQuery = useQuery({
    queryKey: ['folders'],
    queryFn: () => api.folders.list()
  })
  const { data: folders = [], isLoading, isError, error, refetch } = foldersQuery

  const addFromTree = useMutation({
    mutationFn: ({ path, action }: { path: string; action: 'include' | 'exclude' }) =>
      api.folders.add([path], action === 'include' ? 'Y' : 'N'),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['folders'] })
      toast({
        title: `${vars.action === 'include' ? 'Included' : 'Excluded'} ${vars.path}`,
        variant: 'success'
      })
    },
    onError: (err) => toast({ title: errMsg(err, 'Failed to add'), variant: 'destructive' })
  })

  const addManyFromTree = useMutation({
    mutationFn: ({ paths, action }: { paths: string[]; action: 'include' | 'exclude' }) =>
      api.folders.add(paths, action === 'include' ? 'Y' : 'N'),
    onSuccess: (added, vars) => {
      qc.invalidateQueries({ queryKey: ['folders'] })
      toast({
        title: `${vars.action === 'include' ? 'Included' : 'Excluded'} ${added.length} folder${added.length === 1 ? '' : 's'}`,
        variant: 'success'
      })
    },
    onError: (err) => toast({ title: errMsg(err, 'Bulk add failed'), variant: 'destructive' })
  })

  const [driveModalOpen, setDriveModalOpen] = useState(false)

  const removeFolder = useMutation({
    mutationFn: (id: number) => api.folders.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders'] })
      toast({ title: 'Folder removed' })
    },
    onError: (err) => toast({ title: errMsg(err, 'Failed to remove folder'), variant: 'destructive' })
  })

  const [validationError, setValidationError] = useState<string | null>(null)
  const updatePath = useMutation({
    mutationFn: ({ id, newPath }: { id: number; newPath: string }) =>
      api.folders.updatePath(id, newPath),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders'] })
      toast({ title: 'Path updated', variant: 'success' })
    },
    onError: (err) => {
      if (isValidationError(err)) {
        setValidationError(cleanValidationMessage(err, 'Invalid path'))
      } else {
        toast({ title: errMsg(err, 'Failed to update path'), variant: 'destructive' })
      }
    }
  })

  const [search, setSearch] = useState('')
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return folders
    return folders.filter((f) => f.path.toLowerCase().includes(q))
  }, [folders, search])

  const selection = useRowSelection<number>()
  const bulkRemove = useMutation({
    mutationFn: async (ids: number[]) => {
      for (const id of ids) await api.folders.remove(id)
    },
    onSuccess: (_d, ids) => {
      qc.invalidateQueries({ queryKey: ['folders'] })
      selection.clear()
      toast({ title: `${ids.length} folder${ids.length === 1 ? '' : 's'} removed`, variant: 'success' })
    },
    onError: (err) => toast({ title: errMsg(err, 'Bulk remove failed'), variant: 'destructive' })
  })

  // True toggle of an existing row's Include flag — Switch on each row uses
  // this so flipping a folder no longer creates a sibling Exclude entry.
  const setInclude = useMutation({
    mutationFn: ({ id, include }: { id: number; include: 'Y' | 'N' }) =>
      api.folders.setInclude(id, include),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['folders'] })
      toast({
        title: vars.include === 'Y' ? 'Folder included' : 'Folder excluded',
        variant: 'success'
      })
    },
    onError: (err) => toast({ title: errMsg(err, 'Failed to update'), variant: 'destructive' })
  })

  return (
    <Card>
      <ErrorDialog
        open={!!validationError}
        message={validationError}
        title="Invalid folder path"
        onClose={() => setValidationError(null)}
      />
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            Indexed folders
            <HelpHint
              size="sm"
              label="Folders the scanner watches. An Exclude rule under an Include parent wins — so you can say 'scan C:\\Users\\me\\Documents but skip the Tax subfolder' by adding both rows. Counts to the right are read live from the SCL_Demo scan database."
            />
          </CardTitle>
          <CardDescription>
            Green rows are indexed. Orange rows are excluded — they win over any parent include rule.
          </CardDescription>
        </div>
        <Button onClick={() => setDriveModalOpen(true)}>
          <HardDrive className="mr-2 h-4 w-4" />
          Browse drives
        </Button>
      </CardHeader>

      <Dialog open={driveModalOpen} onOpenChange={setDriveModalOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Browse drives</DialogTitle>
            <DialogDescription>
              Expand folders inline, then Include or Exclude any branch.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-md border border-border">
            <DriveTree
              folders={folders}
              onPick={(path, action) => {
                addFromTree.mutate({ path, action })
              }}
              onPickMany={(paths, action) => {
                addManyFromTree.mutate({ paths, action })
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
      <CardContent className="space-y-3">
        {folders.length > 0 && (
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by path"
              className="pl-7"
            />
          </div>
        )}
        <BulkActionBar
          count={selection.selectedCount}
          onClear={selection.clear}
          actions={[
            {
              key: 'remove',
              label: 'Remove all',
              icon: <Trash2 className="mr-1 h-3 w-3" />,
              onClick: () => bulkRemove.mutate(Array.from(selection.selectedIds)),
              disabled: bulkRemove.isPending
            }
          ]}
        />

        {isLoading ? (
          <SkeletonRows count={4} />
        ) : isError ? (
          <QueryErrorState
            title="Couldn't load folders"
            error={error as Error}
            onRetry={() => void refetch()}
          />
        ) : folders.length === 0 ? (
          <EmptyState
            variant="folders"
            title="No folders yet"
            description="Pick a folder with your eBooks or papers. ShortCut Studio will scan and extract topics from each one."
            action={
              <Button onClick={() => setDriveModalOpen(true)}>
                <HardDrive className="mr-2 h-4 w-4" /> Browse drives
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
            No folders match &ldquo;{search}&rdquo;.
          </div>
        ) : (
          <div className="divide-y divide-border rounded-md border border-border">
            {filtered.map((f) => {
              // Disable the Switch while THIS row's setInclude is in flight.
              // Without the guard a fast double-toggle queues two UPDATEs
              // and the user can land on the opposite of what they meant
              // when the second mutation completes after the first.
              const includePending =
                setInclude.isPending && setInclude.variables?.id === f.id
              return (
                <FolderRowItem
                  key={f.id}
                  row={f}
                  selected={selection.isSelected(f.id)}
                  onToggleSelect={() => selection.toggle(f.id)}
                  onRemove={() => removeFolder.mutate(f.id)}
                  onSavePath={(newPath) => updatePath.mutate({ id: f.id, newPath })}
                  onToggleInclude={(include) =>
                    setInclude.mutate({ id: f.id, include: include ? 'Y' : 'N' })
                  }
                  includePending={includePending}
                />
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function FolderRowItem({
  row,
  selected,
  onToggleSelect,
  onRemove,
  onSavePath,
  onToggleInclude,
  includePending
}: {
  row: FolderRow
  selected: boolean
  onToggleSelect: () => void
  onRemove: () => void
  onSavePath: (newPath: string) => void
  onToggleInclude: (include: boolean) => void
  includePending: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(row.path)
  const isIncluded = row.include === 'Y'
  const dirty = editing && draft !== row.path

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-2 text-sm',
        isIncluded ? 'bg-emerald-500/5' : 'bg-amber-500/5',
        selected && 'bg-primary/10'
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggleSelect}
        className="h-3.5 w-3.5 cursor-pointer accent-primary"
        aria-label={`Select ${row.path}`}
      />
      {/* True toggle for the row's Include/Exclude state. The previous
          static badge confused users into clicking again, which created
          a sibling Exclude entry instead of flipping the existing row. */}
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1.5">
            <Switch
              checked={isIncluded}
              onCheckedChange={onToggleInclude}
              disabled={includePending}
              aria-label={isIncluded ? 'Currently included — switch off to exclude' : 'Currently excluded — switch on to include'}
            />
            <span className={cn(
              'text-[10px] font-semibold uppercase tracking-wider',
              isIncluded ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
            )}>
              {isIncluded ? 'Included' : 'Excluded'}
            </span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {isIncluded
            ? 'Switch off to stop scanning this folder.'
            : 'Switch on to include this folder. Excluded children of an Include parent still win.'}
        </TooltipContent>
      </Tooltip>
      {editing ? (
        <>
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSavePath(draft)
                setEditing(false)
              } else if (e.key === 'Escape') {
                setDraft(row.path)
                setEditing(false)
              }
            }}
          />
          {/* Labelled buttons instead of icon-only — without text, two
              chevrons of the same colour next to a path input are
              ambiguous, especially since pressing the wrong one silently
              destroys the in-flight edit. */}
          <Button
            size="sm"
            variant="default"
            disabled={!dirty}
            onClick={() => {
              onSavePath(draft)
              setEditing(false)
            }}
          >
            <Check className="mr-1 h-3 w-3" />
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setDraft(row.path)
              setEditing(false)
            }}
          >
            <X className="mr-1 h-3 w-3" />
            Cancel
          </Button>
        </>
      ) : (
        <>
          <div className="flex flex-1 min-w-0 flex-col gap-0.5">
            <span className="truncate font-mono text-xs" title={row.path}>
              {row.path}
            </span>
            {row.fileCount !== undefined && (
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  {row.fileCount} files
                  <HelpHint
                    size="xs"
                    label="Files inside this folder (and its subfolders) that the scanner has indexed and not flagged ignore. Live count from SCL_Demo's Files table."
                  />
                </span>
                {row.dupeCount !== undefined && row.dupeCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400/90">
                    · {row.dupeCount} dupes
                    <HelpHint
                      size="xs"
                      label="Files the scanner detected as content-duplicates of another file (same hash / same body). They're still indexed but flagged for dedup."
                    />
                  </span>
                )}
                {row.privacyMatchCount !== undefined && row.privacyMatchCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-400/90">
                    · {row.privacyMatchCount} private
                    <HelpHint
                      size="xs"
                      label="Files whose name matches one of your Privacy terms. These get routed to the Private database (instead of Public) so they never get shared on the peer network."
                    />
                  </span>
                )}
              </div>
            )}
          </div>
          <IconButton
            tip="Open this folder in Windows Explorer"
            onClick={() => {
              void api.system.revealFolder(row.path)
            }}
          >
            <ExternalLink className="h-4 w-4" />
          </IconButton>
          <IconButton
            tip="Edit this folder path"
            onClick={() => {
              setDraft(row.path)
              setEditing(true)
            }}
          >
            <Pencil className="h-4 w-4" />
          </IconButton>
          <IconButton tip="Remove this folder from scanning" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </>
      )}
    </div>
  )
}
