import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { Activity, AlertTriangle, PauseCircle, RotateCw } from 'lucide-react'
import type { WorkerStatus } from '@shared/types'
import { cn } from '@/lib/utils'

export function WorkersTab(): JSX.Element {
  const { data: workers = [] } = useQuery({
    queryKey: ['diagnostics-workers'],
    queryFn: () => api.diagnostics.workers(),
    refetchInterval: 5_000
  })

  if (workers.length === 0) {
    return (
      <div className="rounded-md border border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground">
        No workers registered. Set <code>SCL_WORKERS_DIR</code> or check{' '}
        <code>src/main/workers/config.ts</code>.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {workers.map((w) => (
        <WorkerRow key={w.name} worker={w} />
      ))}
    </div>
  )
}

function WorkerRow({ worker }: { worker: WorkerStatus }): JSX.Element {
  const qc = useQueryClient()
  const [log, setLog] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [tailing, setTailing] = useState(false)

  const restart = useMutation({
    mutationFn: () => api.diagnostics.restartWorker(worker.name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['diagnostics-workers'] })
  })

  async function tail(): Promise<void> {
    setTailing(true)
    try {
      const s = await api.diagnostics.tailLog(worker.name, 200)
      setLog(s)
      setExpanded(true)
    } finally {
      setTailing(false)
    }
  }

  return (
    <div className="rounded-md border border-border/60 bg-muted/20 p-3">
      <div className="flex items-center gap-2">
        <StatusDot status={worker.status} />
        <div className="flex-1 text-sm font-medium">{worker.name}</div>
        <span className="font-mono text-[10px] text-muted-foreground">
          {worker.pid ? `pid ${worker.pid}` : 'no pid'} · restarts {worker.restartCount}
        </span>
      </div>
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="outline" onClick={tail} disabled={tailing}>
          {tailing ? 'Tailing…' : 'Tail log'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => restart.mutate()}
          disabled={restart.isPending}
        >
          <RotateCw className="h-3 w-3" /> Restart
        </Button>
        {log != null && (
          <Button size="sm" variant="ghost" onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Hide log' : 'Show log'}
          </Button>
        )}
      </div>
      {expanded && log != null && (
        <pre className="mt-2 max-h-56 overflow-auto rounded-md bg-background p-2 font-mono text-[10px] leading-snug">
          {log || '(empty)'}
        </pre>
      )}
    </div>
  )
}

function StatusDot({ status }: { status: WorkerStatus['status'] }): JSX.Element {
  const Icon = status === 'running' ? Activity : status === 'crashed' ? AlertTriangle : PauseCircle
  return (
    <Icon
      className={cn(
        'h-3.5 w-3.5',
        status === 'running' && 'text-emerald-500',
        status === 'crashed' && 'text-destructive',
        status === 'stopped' && 'text-muted-foreground'
      )}
    />
  )
}
