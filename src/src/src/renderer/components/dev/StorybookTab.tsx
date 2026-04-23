import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { FolderOpen, PlayCircle, RefreshCw } from 'lucide-react'
import type {
  DevStorybookInfo,
  DevStorybookLog,
  DevStorybookScreenshot
} from '@shared/types'
import { cn } from '@/lib/utils'

export function StorybookTab(): JSX.Element {
  const [info, setInfo] = useState<DevStorybookInfo | null>(null)
  const [screenshots, setScreenshots] = useState<DevStorybookScreenshot[]>([])
  const [logs, setLogs] = useState<DevStorybookLog[]>([])
  const [running, setRunning] = useState(false)
  const [zoomed, setZoomed] = useState<DevStorybookScreenshot | null>(null)
  const logBoxRef = useRef<HTMLPreElement | null>(null)

  useEffect(() => {
    void refresh()
    const off = api.dev.onStorybookLog((log) =>
      setLogs((prev) => [...prev, log].slice(-400))
    )
    return off
  }, [])

  useEffect(() => {
    if (logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight
    }
  }, [logs])

  async function refresh(): Promise<void> {
    const [nextInfo, shots] = await Promise.all([
      api.dev.getStorybookInfo(),
      api.dev.listStorybookScreenshots()
    ])
    setInfo(nextInfo)
    setScreenshots(shots)
  }

  async function run(): Promise<void> {
    setLogs([])
    setRunning(true)
    try {
      await api.dev.runStorybook()
      await refresh()
    } finally {
      setRunning(false)
    }
  }

  const hasUnpacked = info?.unpackedExists ?? false

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Last run</div>
          <Button size="sm" variant="ghost" onClick={refresh} className="h-6 px-2">
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
        <div className="mt-2 space-y-1 text-[11px]">
          <KV
            label="STORYBOOK.md"
            value={info?.mtime ? new Date(info.mtime).toLocaleString() : '(never)'}
          />
          <KV label="Screenshots" value={info ? String(info.screenshotCount) : '—'} />
          <KV
            label="Packaged build"
            value={hasUnpacked ? 'found ✓' : 'missing — run npm run build:win first'}
            tone={hasUnpacked ? 'ok' : 'warn'}
          />
        </div>
      </section>

      <section className="space-y-2">
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-[11px] text-amber-900 dark:text-amber-300">
          Regenerate spawns <span className="font-mono">npm run storybook</span>, which
          launches a second Electron instance against{' '}
          <span className="font-mono">release-builds/win-unpacked</span>. Make sure{' '}
          <span className="font-mono">npm run build</span> has run recently — this
          running instance is unaffected.
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={run} disabled={running}>
            <PlayCircle className="h-3 w-3" />
            {running ? 'Running…' : 'Regenerate'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => api.dev.openStorybookFolder()}>
            <FolderOpen className="h-3 w-3" /> Open folder
          </Button>
        </div>
      </section>

      {screenshots.length > 0 && (
        <section>
          <div className="mb-1 flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Screenshots ({screenshots.length})
            </div>
            <div className="text-[10px] text-muted-foreground">click to zoom</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {screenshots.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => setZoomed(s)}
                className="group relative overflow-hidden rounded-md border border-border/60 bg-muted/20 p-0 text-left transition-all hover:border-primary/40 hover:shadow-md"
                title={s.name}
              >
                <img
                  src={s.dataUrl}
                  alt={s.name}
                  className="aspect-[16/10] w-full object-cover transition-transform group-hover:scale-[1.02]"
                  loading="lazy"
                />
                <div className="flex items-center justify-between px-2 py-1 text-[10px]">
                  <span className="truncate font-mono">{s.route}</span>
                  <span className="font-mono text-muted-foreground">
                    {formatBytes(s.sizeBytes)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {logs.length > 0 && (
        <section>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Output
          </div>
          <pre
            ref={logBoxRef}
            className="max-h-64 overflow-auto rounded-md border border-border/60 bg-background p-2 font-mono text-[10px] leading-snug"
          >
            {logs.map((l, i) => (
              <div
                key={i}
                className={cn(
                  l.stream === 'stderr' && 'text-amber-500',
                  l.stream === 'system' && 'text-muted-foreground'
                )}
              >
                {l.line}
              </div>
            ))}
          </pre>
        </section>
      )}

      {zoomed && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
          onClick={() => setZoomed(null)}
        >
          <div
            className="relative max-h-full max-w-full overflow-hidden rounded-lg border border-border/60 bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
              <span className="font-mono text-xs">{zoomed.name}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2"
                onClick={() => setZoomed(null)}
              >
                Close
              </Button>
            </div>
            <img
              src={zoomed.dataUrl}
              alt={zoomed.name}
              className="max-h-[80vh] max-w-[90vw] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  )
}

function KV({
  label,
  value,
  tone
}: {
  label: string
  value: string
  tone?: 'ok' | 'warn'
}): JSX.Element {
  return (
    <div className="flex gap-3">
      <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
      <span
        className={cn(
          'font-mono',
          tone === 'ok' && 'text-emerald-500',
          tone === 'warn' && 'text-amber-500'
        )}
      >
        {value}
      </span>
    </div>
  )
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b}B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)}K`
  return `${(b / 1024 / 1024).toFixed(1)}M`
}
