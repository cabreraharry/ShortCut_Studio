import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Catches React render errors anywhere in the tree, logs them to the
 * AppErrors store, and shows a manual recovery panel. Lives at the root
 * so a feature page that throws never produces a blank screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    try {
      window.electronAPI?.diagnostics
        ?.recordRendererError({
          message: error.message,
          stack: error.stack,
          category: 'react-error-boundary',
          context: { componentStack: info.componentStack ?? null }
        })
        .catch(() => {})
    } catch {
      // contextBridge not present (very early failure) — nothing we can do
    }
  }

  reset = (): void => {
    this.setState({ error: null })
  }

  reload = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <div className="max-w-lg rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Something went wrong</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The UI hit an unexpected error. The details have been logged to Settings →
              Diagnostics → Errors so you can share them with support.
            </p>
            <pre className="mt-3 max-h-40 overflow-auto rounded bg-muted p-2 text-xs">
              {this.state.error.message}
            </pre>
            <div className="mt-4 flex gap-2">
              <Button onClick={this.reset}>Try again</Button>
              <Button variant="outline" onClick={this.reload}>
                Reload app
              </Button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
