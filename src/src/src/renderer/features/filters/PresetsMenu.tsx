import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bookmark, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { FilterPreset, FilterRuleSet } from '@shared/types'

interface PresetsMenuProps {
  activeRuleSet: FilterRuleSet
  onLoad: (preset: FilterPreset) => void
}

export function PresetsMenu({ activeRuleSet, onLoad }: PresetsMenuProps): JSX.Element {
  const qc = useQueryClient()
  const { data: presets = [] } = useQuery({
    queryKey: ['filter-presets'],
    queryFn: () => api.filters.listPresets()
  })
  const [saveOpen, setSaveOpen] = useState(false)
  const [name, setName] = useState('')

  const save = useMutation({
    mutationFn: (n: string) => api.filters.savePreset(n, activeRuleSet),
    onSuccess: (preset) => {
      qc.invalidateQueries({ queryKey: ['filter-presets'] })
      toast({ title: `Saved "${preset.name}"`, variant: 'success' })
      setSaveOpen(false)
      setName('')
    },
    onError: (err) =>
      toast({
        title: err instanceof Error ? err.message : 'Save failed',
        variant: 'destructive'
      })
  })

  const remove = useMutation({
    mutationFn: (id: number) => api.filters.deletePreset(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['filter-presets'] })
  })

  return (
    <div className="flex items-center gap-2">
      <PresetDropdown presets={presets} onLoad={onLoad} onRemove={(id) => remove.mutate(id)} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setName('')
          setSaveOpen(true)
        }}
        disabled={activeRuleSet.rules.length === 0}
      >
        <Save className="mr-1 h-3 w-3" /> Save as preset
      </Button>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save filter preset</DialogTitle>
            <DialogDescription>Name this rule set so you can load it later.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g. "Academic papers (strict)"'
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) save.mutate(name.trim())
              }}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSaveOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => save.mutate(name.trim())}
                disabled={!name.trim() || save.isPending}
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PresetDropdown({
  presets,
  onLoad,
  onRemove
}: {
  presets: FilterPreset[]
  onLoad: (preset: FilterPreset) => void
  onRemove: (id: number) => void
}): JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
      >
        <Bookmark className="mr-1 h-3 w-3" />
        Presets {presets.length > 0 && <span className="ml-1 text-muted-foreground">· {presets.length}</span>}
      </Button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            className={cn(
              'absolute left-0 z-20 mt-1 w-72 rounded-md border border-border bg-popover p-1 shadow-lg'
            )}
          >
            {presets.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                No saved presets yet.
              </div>
            ) : (
              presets.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-accent/50"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onLoad(p)
                      setOpen(false)
                    }}
                    className="flex min-w-0 flex-1 flex-col text-left"
                  >
                    <span className="truncate text-xs font-medium">{p.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {p.ruleSet.rules.length} rule{p.ruleSet.rules.length === 1 ? '' : 's'}
                      {p.ruleSet.folder ? ` · ${p.ruleSet.folder}` : ''}
                    </span>
                  </button>
                  <IconButton
                    tip={`Delete "${p.name}"`}
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`Delete preset "${p.name}"?`)) onRemove(p.id)
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </IconButton>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
