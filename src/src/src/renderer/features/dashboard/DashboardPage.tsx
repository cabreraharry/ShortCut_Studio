import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import {
  Activity,
  Loader2,
  Pause,
  Play,
  AlertCircle,
  CheckCircle2,
  Clock
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { formatNumber } from '@/lib/utils'
import type { Job, JobStatus, TimeRange } from '@shared/types'
import { ProgressGlass } from './ProgressGlass'
import { TimeRangeBar } from './TimeRangeBar'

export default function DashboardPage() {
  const [range, setRange] = useState<TimeRange>('5d')
  const { data: summary } = useQuery({
    queryKey: ['progress-summary', range],
    queryFn: () => api.progress.summary(range),
    refetchInterval: 3000
  })
  const { data: jobs = [] } = useQuery({
    queryKey: ['progress-jobs'],
    queryFn: () => api.progress.jobs(),
    refetchInterval: 3000
  })

  const total = summary?.totalFiles ?? 1
  const localPct = summary ? (summary.processedLocal / total) * 100 : 0
  const peerPct = summary ? (summary.processedPeer / total) * 100 : 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Your library at a glance. Local work in blue, peer contributions in teal.
          </p>
        </div>
        <TimeRangeBar value={range} onChange={setRange} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <Card className="p-6">
          <ProgressGlass
            localPct={localPct}
            peerPct={peerPct}
            totalLabel={summary ? `${formatNumber(summary.processedLocal + summary.processedPeer)} / ${formatNumber(summary.totalFiles)}` : 'Loading…'}
          />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Progress — {summary?.rangeLabel ?? 'Loading…'}</CardTitle>
            <CardDescription>
              Synthetic peer data for v1. Replaced with real numbers once ExecEngine integration lands.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {summary ? (
              <>
                <StatGrid summary={summary} />
                <div className="grid grid-cols-2 gap-4 rounded-md border border-border bg-card/40 p-4 text-xs">
                  <Delta label="Δ local" value={summary.deltaLocal} tone="local" />
                  <Delta label="Δ peer" value={summary.deltaPeer} tone="peer" />
                </div>
                {summary.etaDays !== undefined && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    ETA at current pace: ~{summary.etaDays} day{summary.etaDays === 1 ? '' : 's'}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Loading progress…</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Active jobs
          </CardTitle>
          <CardDescription>Background work in flight. Click a job to view its log.</CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
              No active jobs.
            </div>
          ) : (
            <div className="divide-y divide-border rounded-md border border-border">
              {jobs.map((j) => (
                <JobRow key={j.id} job={j} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatGrid({
  summary
}: {
  summary: {
    totalFiles: number
    processedLocal: number
    processedPeer: number
    remaining: number
  }
}) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <Stat label="Total files" value={summary.totalFiles} />
      <Stat
        label="Processed locally"
        value={summary.processedLocal}
        accent="text-glass-local"
      />
      <Stat
        label="From peers"
        value={summary.processedPeer}
        accent="text-glass-peer"
      />
      <Stat label="Remaining" value={summary.remaining} />
    </div>
  )
}

function Stat({
  label,
  value,
  accent
}: {
  label: string
  value: number
  accent?: string
}) {
  return (
    <div className="rounded-md border border-border bg-card/40 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-xl font-semibold ${accent ?? ''}`}>
        {formatNumber(value)}
      </div>
    </div>
  )
}

function Delta({
  label,
  value,
  tone
}: {
  label: string
  value: number
  tone: 'local' | 'peer'
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`mt-1 font-mono text-lg font-semibold ${
          tone === 'local' ? 'text-glass-local' : 'text-glass-peer'
        }`}
      >
        +{formatNumber(value)}
      </div>
    </div>
  )
}

function JobRow({ job }: { job: Job }) {
  const { icon, variant } = statusStyle(job.status)
  return (
    <div className="flex items-center gap-3 px-4 py-2 text-sm">
      <span className={`flex h-6 w-6 items-center justify-center rounded-full ${variant}`}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="truncate font-medium">{job.label}</div>
        {job.progress && (
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{
                  width: `${(job.progress.current / Math.max(1, job.progress.total)) * 100}%`
                }}
              />
            </div>
            <span className="font-mono">
              {job.progress.current}/{job.progress.total}
            </span>
          </div>
        )}
        {job.error && <div className="mt-1 text-xs text-destructive">{job.error}</div>}
      </div>
      <Button variant="ghost" size="sm">
        log
      </Button>
    </div>
  )
}

function statusStyle(status: JobStatus) {
  switch (status) {
    case 'running':
      return { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, variant: 'bg-primary/20 text-primary' }
    case 'queued':
      return { icon: <Play className="h-3 w-3" />, variant: 'bg-muted text-muted-foreground' }
    case 'completed':
      return { icon: <CheckCircle2 className="h-3.5 w-3.5" />, variant: 'bg-emerald-500/20 text-emerald-400' }
    case 'failed':
      return { icon: <AlertCircle className="h-3.5 w-3.5" />, variant: 'bg-destructive/20 text-destructive' }
    case 'paused':
      return { icon: <Pause className="h-3 w-3" />, variant: 'bg-amber-500/20 text-amber-400' }
    default:
      return { icon: <Play className="h-3 w-3" />, variant: 'bg-muted text-muted-foreground' }
  }
}
