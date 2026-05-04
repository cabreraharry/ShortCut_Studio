import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, CheckCircle2, FileText, Network, Sparkles, Users } from 'lucide-react'
import { api } from '@/lib/api'
import { formatNumber } from '@/lib/utils'

type EventKind = 'scan' | 'peer' | 'topic' | 'dedup' | 'classify'

interface TickerEvent {
  id: string
  kind: EventKind
  label: string
}

function iconFor(kind: EventKind): JSX.Element {
  switch (kind) {
    case 'scan':
      return <FileText className="h-3 w-3" />
    case 'peer':
      return <Users className="h-3 w-3" />
    case 'topic':
      return <Sparkles className="h-3 w-3" />
    case 'dedup':
      return <Network className="h-3 w-3" />
    case 'classify':
      return <CheckCircle2 className="h-3 w-3" />
  }
}

function toneFor(kind: EventKind): string {
  switch (kind) {
    case 'scan':
      return 'border-glass-local/40 bg-glass-local/10 text-glass-local'
    case 'peer':
      return 'border-glass-peer/40 bg-glass-peer/10 text-glass-peer'
    case 'topic':
      return 'border-primary/40 bg-primary/10 text-primary'
    case 'dedup':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
    case 'classify':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'
  }
}

export function ActivityTicker(): JSX.Element {
  const { data: jobs = [] } = useQuery({
    queryKey: ['progress-jobs'],
    queryFn: () => api.progress.jobs(),
    refetchInterval: 5000
  })
  const { data: summary } = useQuery({
    queryKey: ['progress-summary', '5d'],
    queryFn: () => api.progress.summary('5d')
  })
  const { data: dedup } = useQuery({
    queryKey: ['dedupSummary'],
    queryFn: () => api.insights.dedupSummary()
  })

  const events: TickerEvent[] = useMemo(() => {
    const out: TickerEvent[] = []
    jobs.forEach((j) => {
      if (j.kind === 'scan') {
        out.push({ id: `j-${j.id}-s`, kind: 'scan', label: j.label })
      } else if (j.kind === 'topics') {
        out.push({ id: `j-${j.id}-t`, kind: 'topic', label: j.label })
      } else if (j.kind === 'classify') {
        out.push({ id: `j-${j.id}-c`, kind: 'classify', label: j.label })
      }
    })
    if (summary) {
      out.push({
        id: 'sum-peer',
        kind: 'peer',
        label: `Peers contributed +${formatNumber(summary.deltaPeer)} in last 5d`
      })
      out.push({
        id: 'sum-local',
        kind: 'scan',
        label: `You processed +${formatNumber(summary.deltaLocal)} locally in last 5d`
      })
    }
    if (dedup) {
      out.push({
        id: 'dedup',
        kind: 'dedup',
        label: `Network deduped ${dedup.dedupPct}% of your library (${formatNumber(dedup.totalDocs - dedup.uniqueMasterIds)} shared files)`
      })
    }
    // Synthetic flavor events
    const synthetic: TickerEvent[] = [
      { id: 's1', kind: 'peer', label: 'Peer node ah-7f2 joined the network' },
      { id: 's2', kind: 'topic', label: 'Topic "Diffusion Models" gained 3 new papers' },
      { id: 's3', kind: 'dedup', label: 'MasterID collision resolved for Attention_Is_All_You_Need.pdf' },
      { id: 's4', kind: 'scan', label: 'Background scan idle — 142 folders ready' },
      { id: 's5', kind: 'classify', label: 'Queued 4 files for LLM classification' }
    ]
    return [...out, ...synthetic]
  }, [jobs, summary, dedup])

  if (events.length === 0) return <></>

  // Duplicate to allow seamless looping
  const loop = [...events, ...events]

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card/40">
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Activity className="h-3 w-3" />
        Live activity
        <span className="ml-auto flex items-center gap-1 text-[9px]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          streaming
        </span>
      </div>
      <div className="relative overflow-hidden">
        <div
          className="flex gap-3 py-2"
          style={{
            width: 'max-content',
            animation: `tickerScroll ${events.length * 6}s linear infinite`
          }}
        >
          {loop.map((e, i) => (
            <div
              key={`${e.id}-${i}`}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] ${toneFor(e.kind)}`}
            >
              {iconFor(e.kind)}
              <span className="whitespace-nowrap">{e.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
