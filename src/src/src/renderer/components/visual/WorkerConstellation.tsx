import type { WorkerStatus } from '@shared/types'
import { HeartPulse } from 'lucide-react'

function toneFor(status: WorkerStatus['status']): {
  fill: string
  label: string
  pulse: boolean
} {
  switch (status) {
    case 'running':
      return { fill: 'hsl(142 76% 45%)', label: 'running', pulse: true }
    case 'crashed':
      return { fill: 'hsl(0 84% 60%)', label: 'crashed', pulse: true }
    case 'stopped':
    default:
      return { fill: 'hsl(38 92% 50%)', label: 'stopped', pulse: false }
  }
}

export function WorkerConstellation({
  workers
}: {
  workers: WorkerStatus[]
}): JSX.Element {
  if (workers.length === 0) {
    return <></>
  }

  const running = workers.filter((w) => w.status === 'running').length
  const crashed = workers.filter((w) => w.status === 'crashed').length
  const total = workers.length

  return (
    <div className="rounded-lg border border-border bg-card/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <HeartPulse className="h-4 w-4 text-primary" />
          Worker health
        </div>
        <div className="flex gap-3 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {running}/{total} running
          </span>
          {crashed > 0 && (
            <span className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              {crashed} crashed
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
        {workers.map((w, i) => (
          <WorkerNode key={w.name} worker={w} index={i} />
        ))}
      </div>
    </div>
  )
}

function WorkerNode({ worker, index }: { worker: WorkerStatus; index: number }): JSX.Element {
  const t = toneFor(worker.status)
  const size = 70
  const cx = size / 2
  const cy = size / 2

  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-16 w-16" aria-hidden="true">
        {t.pulse && (
          <circle
            cx={cx}
            cy={cy}
            r="24"
            fill={t.fill}
            fillOpacity="0.2"
            style={{
              animation: `peerNodePulse 2.2s ease-in-out ${(index * 0.25).toFixed(2)}s infinite`,
              transformOrigin: `${cx}px ${cy}px`
            }}
          />
        )}
        <circle cx={cx} cy={cy} r="18" fill={t.fill} fillOpacity="0.95" />
        {/* Stylized "chip/worker" glyph */}
        <rect
          x={cx - 7}
          y={cy - 7}
          width="14"
          height="14"
          rx="2"
          fill="white"
          fillOpacity="0.95"
        />
        <circle cx={cx} cy={cy} r="2.5" fill={t.fill} />
      </svg>
      <div className="min-w-0 truncate font-mono text-[10px] font-medium" title={worker.name}>
        {worker.name}
      </div>
      <div
        className={`text-[10px] capitalize ${
          worker.status === 'running'
            ? 'text-emerald-700 dark:text-emerald-400'
            : worker.status === 'crashed'
              ? 'text-rose-700 dark:text-rose-400'
              : 'text-amber-700 dark:text-amber-400'
        }`}
      >
        {t.label}
        {worker.restartCount > 0 && ` · ${worker.restartCount}x`}
      </div>
    </div>
  )
}
