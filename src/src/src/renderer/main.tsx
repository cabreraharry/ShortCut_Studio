import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { ErrorBoundary } from './components/error-boundary'
import './styles/globals.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
})

// Forward uncaught renderer errors to the main-process AppErrors store.
// Best-effort — if electronAPI is missing the call is just a no-op.
function reportRendererError(payload: {
  message: string
  stack?: string
  category?: string
  context?: Record<string, unknown>
}): void {
  try {
    window.electronAPI?.diagnostics?.recordRendererError(payload).catch(() => {})
  } catch {
    /* ignore */
  }
}

window.addEventListener('error', (e) => {
  reportRendererError({
    message: e.message || 'window.onerror',
    stack: e.error instanceof Error ? e.error.stack : undefined,
    category: window.location.hash || 'window.onerror',
    context: {
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno
    }
  })
})

window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason
  const msg =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : JSON.stringify(reason)
  reportRendererError({
    message: `unhandledrejection: ${msg}`,
    stack: reason instanceof Error ? reason.stack : undefined,
    category: window.location.hash || 'unhandledrejection'
  })
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <App />
        </HashRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
