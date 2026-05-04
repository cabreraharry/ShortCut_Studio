import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Download, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import type { UpdaterStatus } from '@shared/types'

function formatSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '—'
  const mb = bytes / (1024 * 1024)
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`
}

function progressPercent(downloaded: number | null, total: number | null): number | null {
  if (!downloaded || !total || total <= 0) return null
  return Math.min(100, Math.floor((downloaded / total) * 100))
}

function formatTime(iso: string | null): string {
  if (!iso) return 'never'
  const d = new Date(iso)
  const now = new Date()
  const sec = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (sec < 60) return 'just now'
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return d.toLocaleString()
}

export function UpdatesCard(): JSX.Element {
  const qc = useQueryClient()
  const [, forceTick] = useState(0)

  const { data: status } = useQuery<UpdaterStatus>({
    queryKey: ['updater-status'],
    queryFn: () => api.updater.status()
  })

  // Subscribe to push events from main so the card reflects state changes
  // (e.g. periodic background checks finding a new version) without polling.
  useEffect(() => {
    const off = api.updater.onStatusChanged((next) => {
      qc.setQueryData(['updater-status'], next)
    })
    return off
  }, [qc])

  // Re-render every 30s so the "Last checked: 5m ago" line stays accurate
  // without forcing a refetch.
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  const checkMutation = useMutation({
    mutationFn: () => api.updater.check(),
    onSuccess: (next) => {
      qc.setQueryData(['updater-status'], next)
      if (next.state === 'up-to-date') {
        toast({ title: 'No updates available', description: `You're on v${next.currentVersion}.` })
      } else if (next.state === 'update-available') {
        toast({
          title: 'Update available',
          description: `v${next.availableVersion} is ready (${formatSize(next.sizeBytes)}).`
        })
      } else if (next.state === 'error') {
        toast({
          title: 'Update check failed',
          description: next.lastError ?? 'Unknown error',
          variant: 'destructive'
        })
      }
    },
    onError: (err: Error) => {
      toast({ title: 'Update check failed', description: err.message, variant: 'destructive' })
    }
  })

  const applyMutation = useMutation({
    mutationFn: () => api.updater.apply(),
    onSuccess: (next) => {
      qc.setQueryData(['updater-status'], next)
      if (next.state === 'ready') {
        toast({
          title: 'Restarting to install update',
          description: 'ShortCut Studio will reopen automatically.'
        })
      } else if (next.state === 'error') {
        toast({
          title: 'Update download failed',
          description: next.lastError ?? 'Unknown error',
          variant: 'destructive'
        })
      }
    }
  })

  const state = status?.state ?? 'idle'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Updates
        </CardTitle>
        <CardDescription>
          Auto-checks every 6 hours. Manual check + restart to apply available below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/20 px-3 py-2">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">Current:</span>
              <span className="font-mono">v{status?.currentVersion ?? '—'}</span>
              <UpdateStateBadge state={state} />
            </div>
            {status?.availableVersion && state === 'update-available' && (
              <div className="text-xs text-muted-foreground">
                Available: <span className="font-mono">v{status.availableVersion}</span> (
                {formatSize(status.sizeBytes)})
              </div>
            )}
            {state === 'downloading' && (
              <DownloadProgressLine
                downloaded={status?.downloadedBytes ?? null}
                total={status?.downloadTotalBytes ?? status?.sizeBytes ?? null}
              />
            )}
            {status?.lastError && state === 'error' && (
              <div className="text-xs text-destructive">{status.lastError}</div>
            )}
            <div className="text-[11px] text-muted-foreground">
              Last checked: {formatTime(status?.lastCheckedAt ?? null)}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => checkMutation.mutate()}
              disabled={checkMutation.isPending || state === 'checking' || state === 'downloading'}
            >
              <RefreshCw
                className={`mr-1 h-3.5 w-3.5 ${checkMutation.isPending || state === 'checking' ? 'animate-spin' : ''}`}
              />
              Check
            </Button>
            {state === 'update-available' && (
              <Button
                size="sm"
                onClick={() => applyMutation.mutate()}
                disabled={applyMutation.isPending}
              >
                <Download className="mr-1 h-3.5 w-3.5" />
                {applyMutation.isPending ? 'Downloading…' : 'Restart and update'}
              </Button>
            )}
          </div>
        </div>
        {state === 'disabled-dev' && (
          <p className="text-xs text-muted-foreground">
            Updates are disabled in dev mode (the running app isn't a packaged build). Run from a
            packaged installer to test the updater.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function DownloadProgressLine({
  downloaded,
  total
}: {
  downloaded: number | null
  total: number | null
}): JSX.Element {
  const pct = progressPercent(downloaded, total)
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">
        {pct !== null
          ? `Downloading… ${formatSize(downloaded)} / ${formatSize(total)} (${pct}%)`
          : `Downloading… ${formatSize(downloaded)}`}
      </div>
      <div className="h-1 w-full overflow-hidden rounded bg-muted">
        <div
          className="h-full bg-primary transition-[width] duration-200"
          style={{ width: pct !== null ? `${pct}%` : '40%' }}
        />
      </div>
    </div>
  )
}

function UpdateStateBadge({ state }: { state: UpdaterStatus['state'] }): JSX.Element | null {
  switch (state) {
    case 'up-to-date':
      return (
        <Badge variant="outline" className="gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-3 w-3" /> Up to date
        </Badge>
      )
    case 'update-available':
      return (
        <Badge variant="outline" className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400">
          <Download className="h-3 w-3" /> Update ready
        </Badge>
      )
    case 'checking':
      return <Badge variant="outline" className="text-muted-foreground">Checking…</Badge>
    case 'downloading':
      return <Badge variant="outline" className="text-muted-foreground">Downloading…</Badge>
    case 'ready':
      return <Badge variant="outline" className="text-muted-foreground">Restarting…</Badge>
    case 'error':
      return (
        <Badge variant="outline" className="gap-1 border-destructive/40 bg-destructive/10 text-destructive">
          <AlertCircle className="h-3 w-3" /> Error
        </Badge>
      )
    case 'disabled-dev':
      return <Badge variant="outline" className="text-muted-foreground">Dev</Badge>
    default:
      return null
  }
}
