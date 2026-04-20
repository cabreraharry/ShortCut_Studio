import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FolderPlus, Trash2, Pencil, Check, X, Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import type { FolderRow, FileTypeFilter } from '@shared/types'

export default function FoldersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Folders</h1>
        <p className="text-sm text-muted-foreground">
          Decide which directories get scanned and which to exclude. Pick the file types that count as scannable content.
        </p>
      </div>
      <FileTypesCard />
      <FoldersCard />
    </div>
  )
}

function FileTypesCard() {
  const qc = useQueryClient()
  const { data: types = [] } = useQuery({
    queryKey: ['fileTypes'],
    queryFn: () => api.fileTypes.list()
  })
  const toggle = useMutation({
    mutationFn: ({ ext, enabled }: { ext: string; enabled: boolean }) =>
      api.fileTypes.toggle(ext, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fileTypes'] })
  })
  const addType = useMutation({
    mutationFn: ({ ext, label }: { ext: string; label: string }) =>
      api.fileTypes.add(ext, label),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fileTypes'] })
  })
  const removeType = useMutation({
    mutationFn: (ext: string) => api.fileTypes.remove(ext),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fileTypes'] })
  })
  const [newExt, setNewExt] = useState('')

  return (
    <Card>
      <CardHeader>
        <CardTitle>File types</CardTitle>
        <CardDescription>
          Click a chip to toggle whether the scanner picks up files of that type.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {types.map((t) => (
            <FileTypeChip
              key={t.extension}
              filter={t}
              onToggle={(enabled) =>
                toggle.mutate({ ext: t.extension, enabled })
              }
              onRemove={() => removeType.mutate(t.extension)}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Add extension (e.g. .azw3)"
            value={newExt}
            onChange={(e) => setNewExt(e.target.value)}
            className="max-w-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newExt.trim()) {
                addType.mutate({ ext: newExt.trim(), label: '' })
                setNewExt('')
              }
            }}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={!newExt.trim()}
            onClick={() => {
              if (newExt.trim()) {
                addType.mutate({ ext: newExt.trim(), label: '' })
                setNewExt('')
              }
            }}
          >
            <Plus className="mr-1 h-3 w-3" />
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function FileTypeChip({
  filter,
  onToggle,
  onRemove
}: {
  filter: FileTypeFilter
  onToggle: (enabled: boolean) => void
  onRemove: () => void
}) {
  return (
    <div className="group flex items-center gap-1">
      <button
        type="button"
        onClick={() => onToggle(!filter.enabled)}
        className={cn(
          'inline-flex items-center gap-2 rounded-md border px-3 py-1 text-xs font-medium transition-colors',
          filter.enabled
            ? 'border-primary/40 bg-primary/15 text-foreground hover:bg-primary/25'
            : 'border-border bg-transparent text-muted-foreground hover:bg-accent/40'
        )}
      >
        <span
          className={cn(
            'h-2 w-2 rounded-full',
            filter.enabled ? 'bg-primary' : 'bg-muted-foreground/40'
          )}
        />
        {filter.label}
        <span className="text-muted-foreground">{filter.extension}</span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        title="Remove filter"
        className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

function FoldersCard() {
  const qc = useQueryClient()
  const { data: folders = [], isLoading } = useQuery({
    queryKey: ['folders'],
    queryFn: () => api.folders.list()
  })

  const addFolders = useMutation({
    mutationFn: async () => {
      const picked = await api.folders.pickDirectory()
      if (picked.length === 0) return []
      return api.folders.add(picked)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['folders'] })
  })

  const removeFolder = useMutation({
    mutationFn: (id: number) => api.folders.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['folders'] })
  })

  const updatePath = useMutation({
    mutationFn: ({ id, newPath }: { id: number; newPath: string }) =>
      api.folders.updatePath(id, newPath),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['folders'] })
  })

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>Indexed folders</CardTitle>
          <CardDescription>
            Green rows are indexed. Orange rows are excluded — they win over any parent include rule.
          </CardDescription>
        </div>
        <Button onClick={() => addFolders.mutate()} disabled={addFolders.isPending}>
          <FolderPlus className="mr-2 h-4 w-4" />
          Add folder
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : folders.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
            No folders yet. Click <b>Add folder</b> to pick one.
          </div>
        ) : (
          <div className="divide-y divide-border rounded-md border border-border">
            {folders.map((f) => (
              <FolderRowItem
                key={f.id}
                row={f}
                onRemove={() => removeFolder.mutate(f.id)}
                onSavePath={(newPath) => updatePath.mutate({ id: f.id, newPath })}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function FolderRowItem({
  row,
  onRemove,
  onSavePath
}: {
  row: FolderRow
  onRemove: () => void
  onSavePath: (newPath: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(row.path)
  const isIncluded = row.include === 'Y'

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-2 text-sm',
        isIncluded ? 'bg-emerald-500/5' : 'bg-amber-500/5'
      )}
    >
      <Badge variant={isIncluded ? 'success' : 'warning'}>
        {isIncluded ? 'Include' : 'Exclude'}
      </Badge>
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
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              onSavePath(draft)
              setEditing(false)
            }}
            title="Save"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              setDraft(row.path)
              setEditing(false)
            }}
            title="Cancel"
          >
            <X className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <>
          <span className="flex-1 truncate font-mono text-xs" title={row.path}>
            {row.path}
          </span>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              setDraft(row.path)
              setEditing(true)
            }}
            title="Edit path"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onRemove} title="Remove">
            <Trash2 className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  )
}
