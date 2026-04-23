import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  Loader2,
  Pause,
  Play,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileStack,
  Cpu,
  Users,
  Hourglass
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { api } from '@/lib/api'
import { formatNumber } from '@/lib/utils'
import type { Job, JobStatus, TimeRange } from '@shared/types'
import { ProgressGlass } from './ProgressGlass'
import { TimeRangeBar } from './TimeRangeBar'
import { DedupCard } from './DedupCard'
import { HoursSavedCard } from './HoursSavedCard'
import { DashboardHeroBanner } from '@/components/visual/HeroBanner'
import { ColorfulStat } from '@/components/visual/ColorfulStat'
import { WelcomeHero } from '@/components/visual/WelcomeHero'
import { ActivityTicker } from '@/components/visual/ActivityTicker'
import { useBurst } from '@/components/visual/Burst'
import { cn } from '@/lib/utils'

type ArtifactTab = 'scan' | 'llm' | 'references' | 'km'

// TODO: these coefficients are placeholders until ExecEngine exposes real
// per-TaskTypeID aggregates. Each value expresses "how far along is this
// artifact relative to the raw scan baseline?" 1.0 = same as scan, <1 = behind.
const ARTIFACT_COEFFICIENTS: Record<ArtifactTab, number> = {
  scan: 1.0,
  llm: 0.72,
  references: 0.55,
  km: 0.84
}

const ARTIFACT_LABELS: Record<ArtifactTab, { short: string; long: string }> = {
  scan: { short: 'Scan', long: 'Text extracted to LaTeX' },
  llm: { short: 'LLM', long: 'LLM summary generated' },
  references: { short: 'References', long: 'Citation list extracted' },
  km: { short: 'KM', long: 'Added to Knowledge Map' }
}

function ArtifactTabs({
  active,
  onChange
}: {
  active: ArtifactTab
  onChange: (t: ArtifactTab) => void
}): JSX.Element {
  const tabs: ArtifactTab[] = ['scan', 'llm', 'references', 'km']
  return (
    <div className="flex items-center gap-0 overflow-hidden rounded-md border border-border bg-muted/30 text-xs">
      {tabs.map((t) => {
        const isActive = t === active
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            title={ARTIFACT_LABELS[t].long}
            className={cn(
              'flex-1 border-b-2 px-2 py-1.5 font-medium transition-colors',
              isActive
                ? 'border-primary bg-background text-foreground'
                : 'border-transparent text-muted-foreground hover:bg-accent/40 hover:text-foreground'
            )}
          >
            {ARTIFACT_LABELS[t].short}
          </button>
        )
      })}
    </div>
  )
}

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
  const { data: folders = [] } = useQuery({
    queryKey: ['folders'],
    queryFn: () => api.folders.list()
  })

  // Four processing-artifact tabs from the "Type of Progress" whiteboard.
  // Each tab scales the raw processed count by a tab-specific coefficient
  // since we have no real per-artifact counts yet.
  // TODO: replace with real counts once ExecEngine exposes TaskTypeID aggregates.
  const [artifactTab, setArtifactTab] = useState<ArtifactTab>('scan')
  const coeff = ARTIFACT_COEFFICIENTS[artifactTab]

  const total = summary?.totalFiles ?? 1
  const rawAllTimeLocalPct = summary ? (summary.processedLocal / total) * 100 : 0
  const rawAllTimePeerPct = summary ? (summary.processedPeer / total) * 100 : 0
  const allTimeLocalPct = rawAllTimeLocalPct * coeff
  const allTimePeerPct = rawAllTimePeerPct * coeff

  // Right bottle: same denominator as left, stacked as `baseline before window`
  // + `delta this window`. Delta is a subset of all-time, so baseline = all-time
  // total minus delta. Total fill matches the left bottle's current state.
  const rawDeltaTotalPct = summary ? ((summary.deltaLocal + summary.deltaPeer) / total) * 100 : 0
  const deltaTotalPct = rawDeltaTotalPct * coeff
  const allTimeTotalPct = allTimeLocalPct + allTimePeerPct
  const baselinePct = Math.max(0, allTimeTotalPct - deltaTotalPct)

  // Milestone burst: fire once when all-time total crosses 25/50/75/100%.
  // Rules-of-hooks: call all hooks BEFORE any early return below.
  const { burst: milestoneBurst, trigger: fireMilestone } = useBurst({
    particleCount: 10,
    distance: 56,
    durationMs: 700,
    colorClass: 'bg-emerald-400',
    ringColorClass: 'border-emerald-400/60'
  })
  const lastTotalRef = useRef<number | null>(null)
  useEffect(() => {
    if (!summary) return
    const pct = Math.round(allTimeTotalPct)
    const prev = lastTotalRef.current
    lastTotalRef.current = pct
    if (prev === null) return // skip initial hydration
    for (const milestone of [25, 50, 75, 100]) {
      if (prev < milestone && pct >= milestone) {
        fireMilestone()
        break
      }
    }
  }, [summary, allTimeTotalPct, fireMilestone])

  if (folders.length === 0) {
    return <WelcomeHero />
  }

  return (
    <div className="space-y-6">
      <DashboardHeroBanner />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Your library at a glance. Local = this PC. Peer = community contributions.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
        <Card className="flex shrink-0 flex-col gap-4 p-6">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Range
            </span>
            <TimeRangeBar value={range} onChange={setRange} />
          </div>
          <ArtifactTabs active={artifactTab} onChange={setArtifactTab} />
          <div className="flex flex-row items-start gap-6">
            <div className="relative flex flex-col items-center">
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                All time
              </h3>
              <div className="relative">
                <ProgressGlass
                  localPct={allTimeLocalPct}
                  peerPct={allTimePeerPct}
                  totalLabel={summary ? `${formatNumber(summary.processedLocal + summary.processedPeer)} / ${formatNumber(summary.totalFiles)}` : 'Loading…'}
                />
                {milestoneBurst}
              </div>
            </div>
            <div className="flex flex-col items-center">
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {summary?.rangeLabel ?? 'Range'}
              </h3>
              <ProgressGlass
                localPct={baselinePct}
                peerPct={deltaTotalPct}
                totalLabel={summary ? `+${formatNumber(summary.deltaLocal + summary.deltaPeer)} this window` : 'Loading…'}
                labels={{ local: 'Before window', peer: `Δ ${summary?.rangeLabel ?? 'range'}` }}
              />
            </div>
          </div>
        </Card>

        <Card className="min-w-0 overflow-hidden">
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
                <ActivityTicker />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Loading progress…</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <DedupCard />
        <HoursSavedCard />
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
    deltaLocal: number
    deltaPeer: number
  }
}) {
  const localTrend = summary.processedLocal > 0
    ? Math.round((summary.deltaLocal / summary.processedLocal) * 1000) / 10
    : 0
  const peerTrend = summary.processedPeer > 0
    ? Math.round((summary.deltaPeer / summary.processedPeer) * 1000) / 10
    : 0
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <ColorfulStat
        label="Total files"
        value={formatNumber(summary.totalFiles)}
        tone="muted"
        icon={<FileStack className="h-4 w-4" />}
      />
      <ColorfulStat
        label="Processed locally"
        value={formatNumber(summary.processedLocal)}
        tone="local"
        icon={<Cpu className="h-4 w-4" />}
        trendPct={localTrend}
        trendLabel="this range"
      />
      <ColorfulStat
        label="From peers"
        value={formatNumber(summary.processedPeer)}
        tone="peer"
        icon={<Users className="h-4 w-4" />}
        trendPct={peerTrend}
        trendLabel="this range"
      />
      <ColorfulStat
        label="Remaining"
        value={formatNumber(summary.remaining)}
        tone="warning"
        icon={<Hourglass className="h-4 w-4" />}
      />
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
  const { icon, variant, label } = statusStyle(job.status)
  return (
    <div className="flex items-center gap-3 px-4 py-2 text-sm">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`flex h-6 w-6 items-center justify-center rounded-full ${variant}`}>
            {icon}
          </span>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
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
      return { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, variant: 'bg-primary/20 text-primary', label: 'Running' }
    case 'queued':
      return { icon: <Play className="h-3 w-3" />, variant: 'bg-muted text-muted-foreground', label: 'Queued' }
    case 'completed':
      return { icon: <CheckCircle2 className="h-3.5 w-3.5" />, variant: 'bg-emerald-500/20 text-emerald-400', label: 'Completed' }
    case 'failed':
      return { icon: <AlertCircle className="h-3.5 w-3.5" />, variant: 'bg-destructive/20 text-destructive', label: 'Failed' }
    case 'paused':
      return { icon: <Pause className="h-3 w-3" />, variant: 'bg-amber-500/20 text-amber-400', label: 'Paused' }
    default:
      return { icon: <Play className="h-3 w-3" />, variant: 'bg-muted text-muted-foreground', label: 'Pending' }
  }
}
