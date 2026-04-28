import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, AlertTriangle, ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { HelpHint } from '@/components/ui/help-hint'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type {
  AppError,
  AppErrorSeverity,
  AppErrorSource,
  ErrorListQuery
} from '@shared/types'

const SOURCE_TONE: Record<AppErrorSource, string> = {
  ipc: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400',
  llm: 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-400',
  execengine: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  worker: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  renderer: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400',
  main: 'border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300'
}

const SOURCE_LABELS: Record<AppErrorSource, string> = {
  ipc: 'IPC',
  llm: 'LLM',
  execengine: 'ExecEngine',
  worker: 'Worker',
  renderer: 'Renderer',
  main: 'Main'
}

const PAGE_SIZE = 50

function formatRelative(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

function formatAbsolute(ts: number): string {
  return new Date(ts).toLocaleString()
}

export function ErrorsCard(): JSX.Element {
  const qc = useQueryClient()
  const [severity, setSeverity] = useState<AppErrorSeverity | 'all'>('error')
  const [source, setSource] = useState<AppErrorSource | 'all'>('all')
  const [page, setPage] = useState(0)
  const [confirmClear, setConfirmClear] = useState(false)

  const query: ErrorListQuery = useMemo(() => {
    const q: ErrorListQuery = { limit: PAGE_SIZE, offset: page * PAGE_SIZE }
    if (severity !== 'all') q.severity = severity
    if (source !== 'all') q.source = source
    return q
  }, [severity, source, page])

  const { data, isLoading } = useQuery({
    queryKey: ['app-errors', query],
    queryFn: () => api.diagnostics.listErrors(query),
    refetchInterval: 5000,
    refetchOnWindowFocus: true
  })

  // Badge counts EVERY error in the last 24h, ignoring the current view
  // filter — otherwise the badge says "in last 24h" but excludes whatever
  // the user filtered out, which is misleading.
  const last24h = useQuery({
    queryKey: ['app-errors-24h-count'],
    queryFn: () =>
      api.diagnostics.listErrors({
        limit: 1,
        sinceTs: Date.now() - 86_400_000
      }),
    refetchInterval: 10_000
  })

  const clearMut = useMutation({
    mutationFn: () => api.diagnostics.clearErrors(),
    onSuccess: (res) => {
      toast({
        title: 'Errors cleared',
        description: `${res.deleted} row${res.deleted === 1 ? '' : 's'} deleted.`
      })
      setConfirmClear(false)
      qc.invalidateQueries({ queryKey: ['app-errors'] })
      qc.invalidateQueries({ queryKey: ['app-errors-24h-count'] })
    }
  })

  const rows = data?.rows ?? []
  const total = data?.total ?? 0
  const hasMore = (page + 1) * PAGE_SIZE < total

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Errors
            <HelpHint
              size="sm"
              label="Captures errors from every layer of the app: IPC handler throws, LLM/ExecEngine failures, worker crashes, and renderer uncaught exceptions. Rolling 10,000-row cap. Persists across restarts."
            />
            {(last24h.data?.total ?? 0) > 0 && (
              <Badge variant="outline" className="ml-1">
                {last24h.data?.total} in last 24h
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            One queryable surface for every layer of the app. Defaults filter to severity ‘error’ to hide
            input-validation noise.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={severity}
            onChange={(e) => {
              setSeverity(e.target.value as AppErrorSeverity | 'all')
              setPage(0)
            }}
          >
            <option value="error">Severity: error</option>
            <option value="warning">Severity: warning</option>
            <option value="all">Severity: all</option>
          </select>
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={source}
            onChange={(e) => {
              setSource(e.target.value as AppErrorSource | 'all')
              setPage(0)
            }}
          >
            <option value="all">Source: all</option>
            <option value="ipc">Source: IPC</option>
            <option value="llm">Source: LLM</option>
            <option value="execengine">Source: ExecEngine</option>
            <option value="worker">Source: Worker</option>
            <option value="renderer">Source: Renderer</option>
            <option value="main">Source: Main</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmClear(true)}
            disabled={total === 0 || clearMut.isPending}
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Clear all
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && rows.length === 0 ? (
          <div className="rounded-md border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
            No errors recorded for the current filter. Nice.
          </div>
        ) : (
          <div className="divide-y divide-border rounded-md border border-border">
            {rows.map((row) => (
              <ErrorRow key={row.id} row={row} />
            ))}
          </div>
        )}
        {(rows.length > 0 || page > 0) && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + rows.length} of {total}
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!hasMore}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear all errors?</DialogTitle>
            <DialogDescription>
              Deletes every row from the AppErrors table. This is irreversible — but the
              store will keep capturing new errors as they happen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => clearMut.mutate()}
              disabled={clearMut.isPending}
            >
              <Trash2 className="mr-1 h-3 w-3" />
              Clear all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function ErrorRow({ row }: { row: AppError }): JSX.Element {
  const [open, setOpen] = useState(false)
  const sourceTone = SOURCE_TONE[row.source as AppErrorSource] ?? SOURCE_TONE.main
  const sourceLabel = SOURCE_LABELS[row.source as AppErrorSource] ?? row.source
  const SeverityIcon = row.severity === 'warning' ? AlertTriangle : AlertCircle
  const severityTone =
    row.severity === 'warning'
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-rose-600 dark:text-rose-400'

  let parsedContext: unknown = null
  try {
    if (row.context) parsedContext = JSON.parse(row.context)
  } catch {
    parsedContext = row.context
  }

  return (
    <div className="px-3 py-2 text-sm">
      <button
        type="button"
        className="flex w-full items-start gap-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="mt-0.5 text-muted-foreground">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
        <SeverityIcon className={cn('mt-0.5 h-4 w-4 shrink-0', severityTone)} />
        <span
          className={cn(
            'shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase',
            sourceTone
          )}
        >
          {sourceLabel}
        </span>
        {row.category && (
          <span className="shrink-0 truncate font-mono text-[11px] text-muted-foreground">
            {row.category}
          </span>
        )}
        <span className="flex-1 truncate text-xs">{row.message}</span>
        <span
          className="shrink-0 text-[11px] text-muted-foreground"
          title={formatAbsolute(row.ts)}
        >
          {formatRelative(row.ts)}
        </span>
      </button>
      {open && (
        <div className="ml-7 mt-2 space-y-2 text-xs">
          <div className="rounded bg-muted/40 p-2 font-mono text-[11px]">
            <div className="mb-1 text-[10px] uppercase text-muted-foreground">Message</div>
            <div className="whitespace-pre-wrap break-words">{row.message}</div>
          </div>
          {row.stack && (
            <div className="rounded bg-muted/40 p-2 font-mono text-[11px]">
              <div className="mb-1 text-[10px] uppercase text-muted-foreground">Stack</div>
              <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-tight">
                {row.stack}
              </pre>
            </div>
          )}
          {parsedContext != null && (
            <div className="rounded bg-muted/40 p-2 font-mono text-[11px]">
              <div className="mb-1 text-[10px] uppercase text-muted-foreground">Context</div>
              <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-tight">
                {typeof parsedContext === 'string'
                  ? parsedContext
                  : JSON.stringify(parsedContext, null, 2)}
              </pre>
            </div>
          )}
          <div className="text-[10px] text-muted-foreground">
            id: {row.id} · captured: {formatAbsolute(row.ts)}
          </div>
        </div>
      )}
    </div>
  )
}
