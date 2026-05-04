import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Boxes, CheckCircle2, Download, ExternalLink, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { ComponentId, ComponentStatus } from '@shared/components-manifest'

function StatusBadge({ status }: { status: ComponentStatus }): JSX.Element {
  if (status.installState === 'present') {
    return (
      <Badge variant="outline" className="gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        {status.detail ?? 'Installed'}
      </Badge>
    )
  }
  if (status.installState === 'absent') {
    return (
      <Badge variant="outline" className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400">
        <XCircle className="h-3 w-3" />
        {status.detail ?? 'Not installed'}
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      {status.detail ?? 'Unknown'}
    </Badge>
  )
}

export function ComponentsCard(): JSX.Element {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['components'],
    queryFn: () => api.components.list(),
    refetchInterval: 15_000
  })
  const installMutation = useMutation({
    mutationFn: (id: ComponentId) => api.components.install(id),
    onSuccess: (_data, id) => {
      const c = data?.find((x) => x.id === id)
      // Optional silent-installer fallback opens the vendor URL until the
      // stub-driven silent install path lands. Show that as "opened page",
      // not "installed", so the toast matches what the user actually sees.
      if (c?.category === 'external-link' || c?.kind === 'silent-installer') {
        toast({ title: 'Opened download page', description: c.displayName })
      } else {
        toast({ title: 'Component installed', description: c?.displayName ?? id })
      }
      qc.invalidateQueries({ queryKey: ['components'] })
    },
    onError: (err: Error, id) => {
      toast({ title: `Install failed: ${id}`, description: err.message, variant: 'destructive' })
    }
  })

  const renderActionButton = (status: ComponentStatus): JSX.Element | null => {
    // Required components are stub-managed. There's no in-app repair flow yet
    // (re-launching the stub with --repair lands later); for now we just
    // tell the user to re-run setup. Less misleading than a disabled button.
    if (status.category === 'required') {
      if (status.installState === 'present') return null
      return (
        <span className="text-xs text-muted-foreground">
          Re-run setup to repair
        </span>
      )
    }
    if (status.installState === 'present') return null
    const inflight = installMutation.isPending && installMutation.variables === status.id
    // Optional silent-installer + external-link both currently open a URL.
    if (status.kind === 'silent-installer' || status.category === 'external-link') {
      return (
        <Button
          size="sm"
          variant="outline"
          disabled={inflight}
          onClick={() => installMutation.mutate(status.id)}
        >
          <ExternalLink className="mr-1 h-3.5 w-3.5" /> Get it
        </Button>
      )
    }
    // Optional zip-extract — reserved for future entries; uses the runtime
    // download path.
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={inflight}
        onClick={() => installMutation.mutate(status.id)}
      >
        <Download className="mr-1 h-3.5 w-3.5" />
        {inflight ? 'Installing…' : 'Install'}
      </Button>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Boxes className="h-4 w-4" /> Components
        </CardTitle>
        <CardDescription>
          Required components installed by the web-stub (IPFS, Nginx) and optional third-party
          local LLM tools (Ollama, LM Studio). Required components are stub-managed; click "Repair
          install" if any go missing. Optional ones can be added at any time.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Detecting…</div>
        ) : (
          <div className="divide-y">
            {data?.map((status) => (
              <div
                key={status.id}
                className={cn(
                  'flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0'
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{status.displayName}</span>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                      {status.category}
                    </Badge>
                    {status.bundleSizeMB ? (
                      <span className="text-xs text-muted-foreground">
                        ~{status.bundleSizeMB} MB
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{status.description}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <StatusBadge status={status} />
                  {renderActionButton(status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
