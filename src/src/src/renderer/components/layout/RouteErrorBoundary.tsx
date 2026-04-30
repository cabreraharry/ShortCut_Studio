import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, ExternalLink, Bug } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// React's error-boundary contract is class-only (componentDidCatch +
// getDerivedStateFromError don't have a hook equivalent yet). One boundary
// per route is enough — a thrown exception inside any feature page surfaces
// here while the AppShell (sidebar / header / tray) keeps working.
//
// The boundary also forwards the caught error to the existing AppErrors DB
// via the diagnostics IPC, so the failure shows up in Settings -> Errors
// without the user having to copy/paste anything.

interface Props {
  children: ReactNode
  // Friendly page name used in the fallback heading. Optional — the boundary
  // also reads window.location.hash as a last-resort fallback.
  routeLabel?: string
}

interface State {
  error: Error | null
}

const REPORT_ISSUE_URL = 'https://github.com/cabreraharry/ShortCut_Studio/issues/new'

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Forward to the AppErrors DB so the failure is recoverable by humans
    // (Settings -> Errors panel) even without devtools open. The IPC handler
    // is fire-and-forget; we don't await because the renderer is mid-crash.
    try {
      window.electronAPI?.diagnostics?.recordRendererError?.({
        message: error.message,
        stack: error.stack,
        category: 'renderer-route-boundary',
        context: {
          route: window.location.hash || window.location.pathname,
          componentStack: info.componentStack ?? undefined
        }
      })
    } catch {
      // boundary itself must not throw — best-effort logging only
    }
  }

  private handleReload = (): void => {
    // Full window reload — clearing the boundary state alone re-renders the
    // same broken tree because cached React Query results, route params, and
    // any module-scoped state survive. Reload guarantees a clean start.
    window.location.reload()
  }

  private handleOpenErrors = (): void => {
    // Don't clear the boundary state ourselves — the hash change triggers a
    // route transition, the new route mounts, and the boundary unmounts as
    // part of that. Calling setState here races with the router and can
    // re-render the broken child for a frame before the route swaps in.
    window.location.hash = '#/settings#errors'
  }

  private handleReportIssue = (): void => {
    window.electronAPI?.app?.openExternal?.(REPORT_ISSUE_URL).catch(() => {
      // ignore — opening external is best-effort
    })
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children

    const label = this.props.routeLabel ?? prettifyRoute(window.location.hash)
    return (
      <div className="space-y-6">
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Something went wrong on the {label} page
            </CardTitle>
            <CardDescription>
              The page hit an unexpected error and stopped rendering. The rest of the app is still
              working — switch pages from the sidebar, or use the buttons below to recover.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <pre className="max-h-40 overflow-auto rounded-md border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
              {this.state.error.message}
            </pre>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="default" onClick={this.handleReload}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Reload page
              </Button>
              <Button size="sm" variant="outline" onClick={this.handleOpenErrors}>
                <Bug className="mr-1.5 h-3.5 w-3.5" />
                Open Errors panel
              </Button>
              <Button size="sm" variant="outline" onClick={this.handleReportIssue}>
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Report on GitHub
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The error was logged to the local Errors DB — Settings → Errors shows the full stack
              and component trace.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }
}

function prettifyRoute(hash: string): string {
  const path = hash.replace(/^#\//, '').split(/[?#]/)[0] ?? ''
  if (!path) return 'current'
  return path
    .split('/')
    .map((segment) => segment.replace(/-/g, ' '))
    .join(' / ')
}
