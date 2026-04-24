import { useQuery } from '@tanstack/react-query'
import {
  CheckCircle2,
  CircleAlert,
  CircleSlash,
  ExternalLink,
  Lock,
  RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { SystemCheckItem, SystemCheckStatus } from '@shared/types'

interface RowDef {
  key: keyof import('@shared/types').SystemCheckResult
  name: string
  summary: string
}

const ROWS: RowDef[] = [
  {
    key: 'workers',
    name: 'SCL_Demo workers',
    summary: 'Background processes for scan, watchdog, Gemini.'
  },
  {
    key: 'ollama',
    name: 'Ollama',
    summary: 'Local LLM runtime. Runs classification without API keys.'
  },
  {
    key: 'ipfs',
    name: 'IPFS Kubo',
    summary: 'Peer-to-peer file layer.'
  },
  {
    key: 'nginx',
    name: 'nginx',
    summary: 'Reverse proxy for the distributed backend.'
  }
]

export function SystemCheckTab(): JSX.Element {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['dev-system-check'],
    queryFn: () => api.dev.systemCheck(),
    staleTime: 15_000
  })

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-border/60 bg-muted/20 p-3 text-[11px] text-muted-foreground">
        Checks for prerequisites the app expects to find on the machine.
        Rows marked <em>reserved</em> describe v2 features the app doesn't
        invoke today — they're here to surface the future dependency story,
        not to prompt action.
      </section>

      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {isLoading ? 'Checking…' : 'Status'}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-[11px]"
          onClick={() => refetch()}
          disabled={isRefetching || isLoading}
        >
          <RefreshCw
            className={cn('h-3 w-3', isRefetching && 'animate-spin')}
          />
          Re-check
        </Button>
      </div>

      <div className="space-y-2">
        {ROWS.map((row) => (
          <SystemCheckRow
            key={row.key}
            name={row.name}
            summary={row.summary}
            item={data?.[row.key]}
            loading={isLoading}
          />
        ))}
      </div>
    </div>
  )
}

function SystemCheckRow({
  name,
  summary,
  item,
  loading
}: {
  name: string
  summary: string
  item: SystemCheckItem | undefined
  loading: boolean
}): JSX.Element {
  const status: SystemCheckStatus = item?.status ?? (loading ? 'missing' : 'error')
  const isReserved = status === 'reserved'

  return (
    <div
      className={cn(
        'rounded-md border p-3',
        isReserved
          ? 'border-border/40 bg-muted/30 opacity-70'
          : 'border-border/60 bg-muted/20'
      )}
    >
      <div className="flex items-start gap-3">
        <StatusBadge status={status} loading={loading} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{name}</span>
            {item?.version && (
              <span className="font-mono text-[10px] text-muted-foreground">
                {item.version}
              </span>
            )}
            {isReserved && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Lock className="h-2.5 w-2.5" />
                Reserved for v2
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{summary}</div>
          {item?.detail && (
            <div className="mt-1.5 font-mono text-[10px] text-muted-foreground/80">
              {item.detail}
            </div>
          )}
        </div>
        {item?.hintUrl && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px]"
            onClick={() => api.app.openExternal(item.hintUrl!)}
          >
            <ExternalLink className="h-3 w-3" />
            {item.hintLabel ?? 'Install'}
          </Button>
        )}
      </div>
    </div>
  )
}

function StatusBadge({
  status,
  loading
}: {
  status: SystemCheckStatus
  loading: boolean
}): JSX.Element {
  if (loading) {
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <RefreshCw className="h-3 w-3 animate-spin" />
      </span>
    )
  }
  if (status === 'ok') {
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
        <CheckCircle2 className="h-3 w-3" />
      </span>
    )
  }
  if (status === 'missing') {
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
        <CircleAlert className="h-3 w-3" />
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
        <CircleAlert className="h-3 w-3" />
      </span>
    )
  }
  // reserved
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <CircleSlash className="h-3 w-3" />
    </span>
  )
}
