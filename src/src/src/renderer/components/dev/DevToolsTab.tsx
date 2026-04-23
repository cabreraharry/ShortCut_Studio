import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { Power, RefreshCw, Wrench, X } from 'lucide-react'

export function DevToolsTab(): JSX.Element {
  const { data: paths } = useQuery({
    queryKey: ['dev-paths'],
    queryFn: () => api.dev.getPaths(),
    staleTime: 60_000
  })
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Controls
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => api.dev.openDevTools()}>
            <Wrench className="h-3 w-3" /> Open DevTools
          </Button>
          <Button size="sm" variant="outline" onClick={() => api.dev.closeDevTools()}>
            <X className="h-3 w-3" /> Close
          </Button>
          <Button size="sm" variant="outline" onClick={() => api.dev.reload()}>
            <RefreshCw className="h-3 w-3" /> Reload renderer
          </Button>
          {!confirmReset ? (
            <Button size="sm" variant="destructive" onClick={() => setConfirmReset(true)}>
              <Power className="h-3 w-3" /> Hard reset…
            </Button>
          ) : (
            <Button size="sm" variant="destructive" onClick={() => api.dev.hardReset()}>
              Click again to quit + relaunch
            </Button>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          App info
        </div>
        <div className="space-y-1.5 rounded-md border border-border/60 bg-muted/30 p-3">
          <KV label="App version" value={paths?.appVersion} />
          <KV label="Platform" value={paths?.platform} />
          <KV label="Electron" value={paths?.electronVersion} />
          <KV label="Chrome" value={paths?.chromeVersion} />
          <KV label="Node" value={paths?.nodeVersion} />
          <KV label="Packaged" value={paths ? String(paths.isPackaged) : undefined} />
          <KV label="User data" value={paths?.userData} mono />
          <KV label="Resources" value={paths?.resources} mono />
          <KV label="Project root" value={paths?.projectRoot} mono />
          <KV label="loc_adm.db" value={paths?.locAdmDb} mono />
          <KV label="Workers dir" value={paths?.workersDir ?? '(not found)'} mono />
        </div>
      </section>
    </div>
  )
}

function KV({
  label,
  value,
  mono
}: {
  label: string
  value?: string | null
  mono?: boolean
}): JSX.Element {
  return (
    <div className="flex gap-3 text-xs">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className={mono ? 'break-all font-mono' : 'break-all'}>
        {value ?? '—'}
      </span>
    </div>
  )
}
