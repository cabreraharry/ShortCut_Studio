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
import { HelpHint, WithHint } from '@/components/ui/help-hint'
import { api } from '@/lib/api'
import { formatNumber } from '@/lib/utils'
import type { Job, JobStatus, TimeRange } from '@shared/types'
import { ProgressGlass } from './ProgressGlass'
import { TimeRangeBar } from './TimeRangeBar'
import { DedupCard } from './DedupCard'
import { HoursSavedCard } from './HoursSavedCard'
import { DashboardHeroBanner } from '@/components/visual/HeroBanner'
import { DashboardWelcomeHero } from './DashboardWelcomeHero'
import { NetworkCard } from './NetworkCard'
import { ColorfulStat } from '@/components/visual/ColorfulStat'
import { ActivityTicker } from '@/components/visual/ActivityTicker'
import { useBurst } from '@/components/visual/Burst'
import { cn } from '@/lib/utils'

type ArtifactTab = 'scan' | 'llm' | 'references' | 'km'

const ARTIFACT_LABELS: Record<
  ArtifactTab,
  { short: string; long: string; hint: string }
> = {
  scan: {
    short: 'Scan',
    long: 'Text extracted',
    hint: "Files whose text has been pulled out of the PDF/EPUB. Real count from SCLFolder: matches files where Words500 was filled at some point OR Probability is set (the column may be cleared after Gemini consumes it)."
  },
  llm: {
    short: 'LLM',
    long: 'AI summary generated',
    hint: 'Files where Gemini has run on the extracted text (Files.Probability > 0 in SCLFolder). Real count.'
  },
  references: {
    short: 'References',
    long: 'Citation list extracted (estimated)',
    hint: "SCL_Demo doesn't track citation parsing as a separate column yet, so this stage is estimated as `LLM × 0.55 / 0.72`. The 'Estimated' badge on the bottle header makes this visible to users."
  },
  km: {
    short: 'KM',
    long: 'Added to Knowledge Map',
    hint: 'Files joined to a topic in the TopicFiles table. Real count — will sit at 0% until topic generation has run on this library.'
  }
}

function EstimatedBadge(): JSX.Element {
  return (
    <WithHint label="This stage doesn't have its own column in SCL_Demo's Files table yet. The number is derived from the LLM count by a fixed coefficient (0.55 / 0.72) so the bottle still shows something visually — it'll be replaced with a real count once SCL_Demo's pipeline writes a citations-parsed signal.">
      <span className="inline-flex cursor-help items-center rounded-sm border border-amber-500/40 bg-amber-500/15 px-1 py-0 text-[9px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
        Est
      </span>
    </WithHint>
  )
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
          <WithHint
            key={t}
            label={
              <>
                <div className="font-semibold">{ARTIFACT_LABELS[t].long}</div>
                <div className="mt-1 text-muted-foreground">
                  {ARTIFACT_LABELS[t].hint}
                </div>
              </>
            }
          >
            <button
              type="button"
              onClick={() => onChange(t)}
              className={cn(
                'flex-1 border-b-2 px-2 py-1.5 font-medium transition-colors',
                isActive
                  ? 'border-primary bg-background text-foreground'
                  : 'border-transparent text-muted-foreground hover:bg-accent/40 hover:text-foreground'
              )}
            >
              {ARTIFACT_LABELS[t].short}
            </button>
          </WithHint>
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
  const { data: byStage } = useQuery({
    queryKey: ['progress-byStage', range],
    queryFn: () => api.progress.byStage(range),
    refetchInterval: 3000
  })
  const { data: jobs = [] } = useQuery({
    queryKey: ['progress-jobs'],
    queryFn: () => api.progress.jobs(),
    refetchInterval: 3000
  })
  const [artifactTab, setArtifactTab] = useState<ArtifactTab>('scan')

  // Per-stage data drives the bottles. The first render before byStage resolves
  // falls back to the existing scan-baseline summary so the dashboard isn't
  // blank during the initial fetch.
  const total = byStage?.totalFiles ?? summary?.totalFiles ?? 1
  const stage = byStage?.stages[artifactTab]
  const stageLocal = stage?.processedLocal ?? summary?.processedLocal ?? 0
  const stagePeer = stage?.processedPeer ?? summary?.processedPeer ?? 0
  const stageDeltaLocal = stage?.deltaLocal ?? summary?.deltaLocal ?? 0
  const stageDeltaPeer = stage?.deltaPeer ?? summary?.deltaPeer ?? 0
  const isEstimated = stage?.estimated ?? false

  const allTimeLocalPct = (stageLocal / total) * 100
  const allTimePeerPct = (stagePeer / total) * 100

  // Right bottle: same denominator, baseline (before window) + delta (this window).
  const deltaTotalPct = ((stageDeltaLocal + stageDeltaPeer) / total) * 100
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

  return (
    <div className="space-y-6">
      <DashboardWelcomeHero />
      <DashboardHeroBanner />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          Your library at a glance.
          <span className="inline-flex items-center gap-1">
            <span className="font-medium">Local</span>
            <HelpHint
              size="xs"
              label="Files that THIS PC has processed (extracted text + ran the AI on). Reads counts directly from SCL_Demo's scan database for the active mode (Public / Private)."
            />
            = this PC.
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="font-medium">Peer</span>
            <HelpHint
              size="xs"
              label="Files processed by other community members and shared back to you over the SCL peer network. Always 0 until the ExecEngine peer layer ships — synthetic peer data was removed when the dashboard switched to real local counts."
            />
            = community contributions.
          </span>
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
        <Card className="flex shrink-0 flex-col gap-4 p-6">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Range
              <HelpHint
                size="xs"
                label="How far back to look for the right-hand 'this window' bottle. Doesn't change the All-Time totals on the left — those are always cumulative."
              />
            </span>
            <TimeRangeBar value={range} onChange={setRange} />
          </div>
          <div className="flex items-center gap-2">
            <ArtifactTabs active={artifactTab} onChange={setArtifactTab} />
            <HelpHint
              size="xs"
              label="Each tab is a stage of processing. Scan / LLM / KM read distinct columns from SCL_Demo's Files table — switching tabs changes both the percent AND the raw 'X / Y' count. References has no real column yet, so it's marked 'Estimated' on the bottle header."
            />
          </div>
          <div className="flex flex-row items-start gap-6">
            <div className="relative flex flex-col items-center">
              <h3 className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                All time
                {isEstimated && <EstimatedBadge />}
                <HelpHint
                  size="xs"
                  label="Cumulative total for the active stage. The percent is processed ÷ total. The 'X / Y' line under it is the raw counts. Switching tabs changes both numbers — they read different columns from SCL_Demo."
                />
              </h3>
              <div className="relative">
                <ProgressGlass
                  localPct={allTimeLocalPct}
                  peerPct={allTimePeerPct}
                  totalLabel={byStage ? `${formatNumber(stageLocal + stagePeer)} / ${formatNumber(total)}` : 'Loading…'}
                />
                {milestoneBurst}
              </div>
            </div>
            <div className="flex flex-col items-center">
              <h3 className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {byStage?.rangeLabel ?? summary?.rangeLabel ?? 'Range'}
                {isEstimated && <EstimatedBadge />}
                <HelpHint
                  size="xs"
                  label="Same totals as the left bottle but split into 'Before window' (blue, what was already done before this range started) and 'Δ this window' (teal, the change during the range). Per-stage deltas are scaled proportionally; real per-stage history lands when ProgressSnapshots is wired (v1.5)."
                />
              </h3>
              <ProgressGlass
                localPct={baselinePct}
                peerPct={deltaTotalPct}
                totalLabel={byStage ? `+${formatNumber(stageDeltaLocal + stageDeltaPeer)} this window` : 'Loading…'}
                labels={{ local: 'Before window', peer: `Δ ${byStage?.rangeLabel ?? summary?.rangeLabel ?? 'range'}` }}
              />
            </div>
          </div>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Progress — {summary?.rangeLabel ?? 'Loading…'}
              <HelpHint
                size="sm"
                label="Numerical breakdown of the bottles on the left. 'Total files' and 'Processed locally' are real counts from SCL_Demo's Files table; 'From peers' is always 0 (peer data not wired yet); 'Remaining' = total − processed."
              />
            </CardTitle>
            <CardDescription>
              Local counts are real (read from SCLFolder DB). Peer / range deltas / ETA are still synthetic until ExecEngine ships its peer layer + ProgressSnapshots is populated.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {summary ? (
              <>
                <StatGrid summary={summary} />
                <div className="grid grid-cols-2 gap-4 rounded-md border border-border bg-card/40 p-4 text-xs">
                  <Delta
                    label="Δ local"
                    value={summary.deltaLocal}
                    tone="local"
                    hint="Files processed by THIS PC during the selected range. Currently a synthetic estimate (per-range curve in mock.ts); v1.5 will compute it from real ProgressSnapshots history."
                  />
                  <Delta
                    label="Δ peer"
                    value={summary.deltaPeer}
                    tone="peer"
                    hint="Files contributed by other peers during the range. Synthetic until the ExecEngine peer layer is live."
                  />
                </div>
                {summary.etaDays !== undefined && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    ETA at current pace: ~{summary.etaDays} day{summary.etaDays === 1 ? '' : 's'}
                    <HelpHint
                      size="xs"
                      label="Days until 100% at the current local + peer rate. Derived from the same synthetic delta numbers as the bottles, so treat this as a rough placeholder until v1.5 lands."
                    />
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
            <HelpHint
              size="sm"
              label="Background work currently running on this PC: scans, AI topic generation, classification. Currently shows synthetic mock entries until SCL_Demo workers report real job state via the supervisor's worker_api channel."
            />
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

      <NetworkCard />
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
        label={
          <>
            Total files
            <HelpHint
              size="xs"
              label="Every file SCL_Demo's scanner has indexed in the active mode that isn't flagged ignore (Files.IgnoreFile = 'N')."
            />
          </>
        }
        value={formatNumber(summary.totalFiles)}
        tone="muted"
        icon={<FileStack className="h-4 w-4" />}
      />
      <ColorfulStat
        label={
          <>
            Processed locally
            <HelpHint
              size="xs"
              label="Files THIS PC has processed for the active stage (Files.Probability > 0). Read directly from the SCLFolder DB on every refresh."
            />
          </>
        }
        value={formatNumber(summary.processedLocal)}
        tone="local"
        icon={<Cpu className="h-4 w-4" />}
        trendPct={localTrend}
        trendLabel="this range"
      />
      <ColorfulStat
        label={
          <>
            From peers
            <HelpHint
              size="xs"
              label="Files processed by other community members and shared back to you. Always 0 until ExecEngine's peer layer ships."
            />
          </>
        }
        value={formatNumber(summary.processedPeer)}
        tone="peer"
        icon={<Users className="h-4 w-4" />}
        trendPct={peerTrend}
        trendLabel="this range"
      />
      <ColorfulStat
        label={
          <>
            Remaining
            <HelpHint
              size="xs"
              label="Total files − (processed locally + from peers). The work the supervisor + AI workers still have queued."
            />
          </>
        }
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
  tone,
  hint
}: {
  label: string
  value: number
  tone: 'local' | 'peer'
  hint?: string
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {hint && <HelpHint size="xs" label={hint} />}
      </div>
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
