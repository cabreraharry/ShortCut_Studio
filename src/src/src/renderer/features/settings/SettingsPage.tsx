import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import {
  FolderOpen,
  Save,
  HeartPulse,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Keyboard,
  Wrench,
  Rocket
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { DriveTree } from '@/components/drive-tree/DriveTree'
import { WorkerConstellation } from '@/components/visual/WorkerConstellation'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { SHOW_DIAGNOSTICS } from '@/lib/app-info'
import type { AppSettings, WorkerStatus } from '@shared/types'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Paths, admin values, and worker diagnostics. For an overview of the app, click the{' '}
          <span className="font-semibold">?</span> icon in the top-right.
        </p>
      </div>
      <PathsCard />
      <AdminCard />
      {SHOW_DIAGNOSTICS && <DiagnosticsCard />}
      <DeveloperTip />
    </div>
  )
}

function DeveloperTip() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const rerunSetup = useMutation({
    mutationFn: () => api.settings.update({ setupCompleted: false }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['settings'] })
      navigate('/setup')
    }
  })
  return (
    <Card className="border-dashed bg-muted/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Wrench className="h-4 w-4" />
          Developer tools
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-background px-2 py-1 font-mono text-[11px] text-foreground shadow-sm">
            <Keyboard className="h-3 w-3" />
            Ctrl
            <span className="text-muted-foreground">+</span>
            Shift
            <span className="text-muted-foreground">+</span>D
          </span>
          <span>
            opens the developer overlay — SQL console, worker controls, live IPC
            inspector, and the storybook runner. Hidden by default so end users
            don’t see it.
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <Button
            size="sm"
            variant="outline"
            onClick={() => rerunSetup.mutate()}
            disabled={rerunSetup.isPending}
          >
            <Rocket className="h-3 w-3" />
            Re-run setup wizard
          </Button>
          <span>
            Resets the first-run flag and drops you back into the onboarding
            flow — useful for demoing to new users.
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function PathsCard() {
  const [browseOpen, setBrowseOpen] = useState(false)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4" />
          Paths
        </CardTitle>
        <CardDescription>
          Where SCL stores your cache and search folder. Move them to another drive if space runs tight.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <PathRow
          label="Hidden content folder"
          description="Thumbnails, extracted metadata, IPFS-staging content."
          currentValue="%AppData%\ShortCut Studio\content"
          onBrowse={() => setBrowseOpen(true)}
        />
        <PathRow
          label="Desktop search folder"
          description="Shortcuts organized by topic. You can use OS search inside."
          currentValue="%UserProfile%\Desktop\_SCL_"
          onBrowse={() => setBrowseOpen(true)}
        />
      </CardContent>

      <Dialog open={browseOpen} onOpenChange={setBrowseOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Browse drives</DialogTitle>
            <DialogDescription>
              Preview-only for now. Click Include or Exclude to see the destination; the actual Move flow lands
              in a later task.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-md border border-border">
            <DriveTree
              onPick={(path) => {
                setBrowseOpen(false)
                toast({
                  title: 'Path move not yet implemented',
                  description: `You picked ${path}. The Move flow will land in a later task.`
                })
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function PathRow({
  label,
  description,
  currentValue,
  onBrowse
}: {
  label: string
  description: string
  currentValue: string
  onBrowse: () => void
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={onBrowse}>
            <HardDrive className="mr-1 h-3 w-3" />
            Browse…
          </Button>
          <Button variant="outline" size="sm" disabled>
            Move…
          </Button>
        </div>
      </div>
      <div className="mt-2 rounded bg-muted/30 px-2 py-1 font-mono text-xs text-muted-foreground">
        {currentValue}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Move requires full implementation (copies content + updates shortcuts + app restart). Wired up in a later task.
      </p>
    </div>
  )
}

function AdminCard() {
  const qc = useQueryClient()
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.settings.get()
  })
  const update = useMutation({
    mutationFn: (patch: Partial<AppSettings>) => api.settings.update(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] })
  })
  const [draft, setDraft] = useState<Partial<AppSettings>>({})

  useEffect(() => {
    if (settings) setDraft(settings)
  }, [settings])

  const hasChanges =
    settings &&
    (draft.localhostPort !== settings.localhostPort ||
      draft.numTopicThreshold !== settings.numTopicThreshold ||
      draft.cpuPerfThreshold !== settings.cpuPerfThreshold)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin values</CardTitle>
        <CardDescription>
          Power-user knobs. Defaults are sane; change only if you know what you're doing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Field
          label="Localhost port"
          description="ExecEngine queue bus (default 44999)"
          value={draft.localhostPort?.toString() ?? ''}
          onChange={(v) => setDraft({ ...draft, localhostPort: Number(v) || 0 })}
        />
        <Field
          label="Topic threshold"
          description="Minimum files before a topic is auto-created"
          value={draft.numTopicThreshold?.toString() ?? ''}
          onChange={(v) => setDraft({ ...draft, numTopicThreshold: Number(v) || 0 })}
        />
        <Field
          label="CPU threshold (%)"
          description="Background work pauses when CPU load is above this"
          value={draft.cpuPerfThreshold?.toString() ?? ''}
          onChange={(v) => setDraft({ ...draft, cpuPerfThreshold: Number(v) || 0 })}
        />
        <div className="flex justify-end">
          <Button
            disabled={!hasChanges || update.isPending}
            onClick={() => update.mutate(draft)}
          >
            <Save className="mr-2 h-4 w-4" />
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Field({
  label,
  description,
  value,
  onChange
}: {
  label: string
  description: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="grid gap-1 md:grid-cols-[240px_1fr] md:items-center">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function DiagnosticsCard() {
  const qc = useQueryClient()
  const { data: workers = [] } = useQuery({
    queryKey: ['workers'],
    queryFn: () => api.diagnostics.workers(),
    refetchInterval: 5000
  })
  const restart = useMutation({
    mutationFn: (name: string) => api.diagnostics.restartWorker(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workers'] })
  })
  const [open, setOpen] = useState(false)
  const [log, setLog] = useState<Record<string, string>>({})

  const fetchLog = async (name: string) => {
    const txt = await api.diagnostics.tailLog(name, 200)
    setLog((prev) => ({ ...prev, [name]: txt }))
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <HeartPulse className="h-4 w-4" />
            Diagnostics
          </CardTitle>
          <CardDescription>
            Background worker status. Tuck this panel away unless something looks wrong.
          </CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide' : 'Show'}
        </Button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4">
          <WorkerConstellation workers={workers} />
          <div className="divide-y divide-border rounded-md border border-border">
            {workers.map((w) => (
              <WorkerRow
                key={w.name}
                worker={w}
                onRestart={() => restart.mutate(w.name)}
                onTail={() => fetchLog(w.name)}
                logText={log[w.name]}
              />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

function WorkerRow({
  worker,
  onRestart,
  onTail,
  logText
}: {
  worker: WorkerStatus
  onRestart: () => void
  onTail: () => void
  logText?: string
}) {
  const tone =
    worker.status === 'running'
      ? 'text-emerald-400'
      : worker.status === 'crashed'
        ? 'text-destructive'
        : 'text-muted-foreground'
  const Icon =
    worker.status === 'running'
      ? CheckCircle2
      : worker.status === 'crashed'
        ? AlertCircle
        : HeartPulse

  return (
    <div className="flex flex-col gap-2 px-4 py-3 text-sm">
      <div className="flex items-center gap-3">
        <Icon className={`h-4 w-4 ${tone}`} />
        <div className="flex-1">
          <div className="font-mono text-xs font-semibold">{worker.name}</div>
          <div className="text-xs text-muted-foreground">
            status: <Badge variant="outline">{worker.status}</Badge>
            {worker.restartCount > 0 && (
              <span className="ml-2">restarts: {worker.restartCount}</span>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onTail}>
          Tail log
        </Button>
        <Button variant="outline" size="sm" onClick={onRestart}>
          <RotateCw className="mr-1 h-3 w-3" />
          Restart
        </Button>
      </div>
      {logText && (
        <pre className="max-h-40 overflow-auto rounded bg-muted/30 p-2 font-mono text-[10px] leading-tight text-muted-foreground">
          {logText}
        </pre>
      )}
    </div>
  )
}
