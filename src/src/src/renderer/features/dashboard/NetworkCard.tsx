import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  Database,
  Lock,
  Network as NetworkIcon,
  TrendingUp,
  CheckCircle2
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tip } from '@/components/ui/cursor-tooltip'
import { api } from '@/lib/api'
import { cn, formatNumber } from '@/lib/utils'
import type { NetworkSummary, DbFileInfo } from '@shared/types'
import { NetworkSparkline } from './NetworkSparkline'

const REQUEST_DESCRIPTIONS: Record<'cbr' | 'csct' | 'cdreq', string> = {
  cbr: 'Content Build Requests — package documents up to the Agent Hub.',
  csct: 'Content Self-Check Triggers — periodic state syncs with the Hub.',
  cdreq: 'Content Data Requests — pulls a peer-shared document by hash.'
}

export function NetworkCard(): JSX.Element {
  const { data, isLoading } = useQuery({
    queryKey: ['network-summary'],
    queryFn: () => api.network.summary(),
    refetchInterval: 5_000
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <NetworkIcon className="h-4 w-4" />
          Network &amp; databases
        </CardTitle>
        <CardDescription>
          Your link to the peer network and the local stores backing it. Synthetic data for the v1 demo — real values land when ExecEngine integration ships.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
          <AgentHubQuadrant data={data?.agentHub} loading={isLoading} />
          <DatabasesQuadrant files={data?.dbFiles ?? []} loading={isLoading} />
          <PendingQuadrant pending={data?.pending} loading={isLoading} />
          <GrowthQuadrant
            points={data?.growth ?? []}
            pctChange={data?.growthPctChange ?? 0}
            loading={isLoading}
          />
        </div>
      </CardContent>
    </Card>
  )
}

// ---------- Quadrant 1: Agent Hub ----------

function AgentHubQuadrant({
  data,
  loading
}: {
  data: NetworkSummary['agentHub'] | undefined
  loading: boolean
}): JSX.Element {
  return (
    <section>
      <SectionLabel icon={<Activity className="h-3 w-3" />}>Agent Hub</SectionLabel>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex h-2 w-2 rounded-full',
              data?.connected
                ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]'
                : 'bg-muted-foreground'
            )}
          />
          <span className="font-medium">
            {loading ? 'Connecting…' : data?.connected ? 'Connected' : 'Offline'}
          </span>
          {data?.hubServerId && (
            <span className="font-mono text-[10px] text-muted-foreground">
              · {data.hubServerId}
            </span>
          )}
        </div>
        <KvLine label="Last sync" value={data ? agoLabel(data.lastSyncMs) : '—'} />
        <KvLine label="Peer ID" value={data?.peerId ?? '—'} mono />
        <KvLine
          label="Auth fresh"
          value={data ? remainingLabel(data.authExpiresMs) : '—'}
        />
      </div>
    </section>
  )
}

// ---------- Quadrant 2: Local databases ----------

function DatabasesQuadrant({
  files,
  loading
}: {
  files: DbFileInfo[]
  loading: boolean
}): JSX.Element {
  return (
    <section>
      <SectionLabel icon={<Database className="h-3 w-3" />}>Local databases</SectionLabel>
      <div className="space-y-1.5 text-xs">
        {loading && files.length === 0 ? (
          <div className="text-muted-foreground">Reading file sizes…</div>
        ) : (
          files.map((f) => <DbRow key={f.name} file={f} />)
        )}
      </div>
    </section>
  )
}

function DbRow({ file }: { file: DbFileInfo }): JSX.Element {
  return (
    <Tip content={file.path}>
      <div className="flex items-center justify-between gap-3 cursor-default">
        <span
          className={cn(
            'flex items-center gap-1.5 truncate font-mono',
            file.reservedForV2 && 'text-muted-foreground/70'
          )}
        >
          {file.reservedForV2 && <Lock className="h-2.5 w-2.5 shrink-0" />}
          {file.name}
        </span>
        <span
          className={cn(
            'shrink-0 font-mono',
            file.reservedForV2 ? 'text-[10px] uppercase tracking-wider text-muted-foreground/60' : ''
          )}
        >
          {file.reservedForV2
            ? 'v2'
            : file.sizeBytes == null
              ? '—'
              : formatBytes(file.sizeBytes)}
        </span>
      </div>
    </Tip>
  )
}

// ---------- Quadrant 3: Pending requests ----------

function PendingQuadrant({
  pending,
  loading
}: {
  pending: NetworkSummary['pending'] | undefined
  loading: boolean
}): JSX.Element {
  return (
    <section>
      <SectionLabel icon={<CheckCircle2 className="h-3 w-3" />}>
        In flight
      </SectionLabel>
      <div className="space-y-1.5 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <PendingChip label="CBR" count={pending?.cbr} kind="cbr" loading={loading} />
          <PendingChip label="CSCT" count={pending?.csct} kind="csct" loading={loading} />
          <PendingChip label="CDREQ" count={pending?.cdreq} kind="cdreq" loading={loading} />
        </div>
        <KvLine
          label="Avg age"
          value={
            pending ? `${(pending.avgAgeMs / 1000).toFixed(1)}s` : '—'
          }
        />
        <KvLine
          label="Throughput"
          value={pending ? `${pending.throughputPerSec} req/s` : '—'}
        />
      </div>
    </section>
  )
}

function PendingChip({
  label,
  count,
  kind,
  loading
}: {
  label: string
  count: number | undefined
  kind: 'cbr' | 'csct' | 'cdreq'
  loading: boolean
}): JSX.Element {
  const tone =
    kind === 'cbr'
      ? 'border-glass-local/40 bg-glass-local/15 text-glass-local'
      : kind === 'csct'
        ? 'border-primary/40 bg-primary/15 text-primary'
        : 'border-glass-peer/40 bg-glass-peer/15 text-glass-peer'

  return (
    <Tip content={REQUEST_DESCRIPTIONS[kind]}>
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[11px]',
          tone
        )}
      >
        {label}
        <span className="font-semibold">
          {loading ? '…' : count ?? 0}
        </span>
      </span>
    </Tip>
  )
}

// ---------- Quadrant 4: Growth sparkline ----------

function GrowthQuadrant({
  points,
  pctChange,
  loading
}: {
  points: NetworkSummary['growth']
  pctChange: number
  loading: boolean
}): JSX.Element {
  return (
    <section>
      <SectionLabel icon={<TrendingUp className="h-3 w-3" />}>Growth (3d)</SectionLabel>
      <div className="flex items-end justify-between gap-3">
        <div className="flex-shrink-0">
          <NetworkSparkline points={points} />
        </div>
        <div className="flex flex-col items-end text-xs">
          <span
            className={cn(
              'font-mono text-base font-semibold',
              pctChange > 0 ? 'text-emerald-500' : 'text-muted-foreground'
            )}
          >
            {pctChange >= 0 ? '+' : ''}
            {pctChange}%
          </span>
          <span className="text-[10px] text-muted-foreground">
            {loading
              ? 'Loading…'
              : points.length > 0
                ? `${formatNumber(points[points.length - 1].totalRows)} rows`
                : 'No data'}
          </span>
        </div>
      </div>
    </section>
  )
}

// ---------- Shared ----------

function SectionLabel({
  children,
  icon
}: {
  children: React.ReactNode
  icon: React.ReactNode
}): JSX.Element {
  return (
    <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {icon}
      {children}
    </div>
  )
}

function KvLine({
  label,
  value,
  mono
}: {
  label: string
  value: string
  mono?: boolean
}): JSX.Element {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <span className={cn('truncate', mono && 'font-mono text-[11px]')}>{value}</span>
    </div>
  )
}

function agoLabel(ms: number | null): string {
  if (ms == null) return '—'
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}

function remainingLabel(ms: number | null): string {
  if (ms == null) return '—'
  const s = Math.max(0, Math.floor((ms - Date.now()) / 1000))
  if (s <= 0) return 'expired'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m left`
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${h}h ${mm}m left`
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`
  return `${(b / 1024 / 1024 / 1024).toFixed(1)} GB`
}
