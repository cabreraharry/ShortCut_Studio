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

// Mode-change broadcast → scoped query invalidation. Without this, an
// in-flight query started in publ mode could land its response in the
// priv-mode cache and the user would see private topics with public file
// counts (the race the production audit flagged). Registering at module
// scope is intentional: the QueryClient is already a singleton, and the
// renderer-side broadcast listener is a cheap once-per-process subscription.
//
// Scoped to mode-sensitive query key prefixes ONLY — invalidating
// everything (qc.invalidateQueries() with no key) would cause the refetch
// storm the same audit flagged for the data-source toggle. New
// mode-sensitive feature queries should add their key prefix here.
//
// Predicate is `q.queryKey[0] === prefix`, so subkey-bearing queries
// (e.g. ['topics', filter]) match too. The first array element MUST be a
// string for any query that wants to participate; nested-array first
// elements are not supported.
const MODE_SENSITIVE_PREFIXES = [
  'topics',
  'topicReview',
  'topicDistribution',
  'superCategories',
  'insights',
  'insights-folder-overview',
  'insights-doc-detail',
  'insights-groups',
  'km', // knowledge-map page uses ['km', superCategoryId] as its key
  'folders',
  'progress-summary',
  'progress-jobs',
  'progress-snapshots',
  'progress-byStage',
  'dedupSummary',
  'folder-health',
  'dashboard',
  'filter-preview',
  'filter-all-files'
] as const

window.electronAPI?.mode?.onChanged?.(() => {
  for (const prefix of MODE_SENSITIVE_PREFIXES) {
    // predicate match invalidates ['topics'] AND ['topics', subKey, ...].
    queryClient.invalidateQueries({
      predicate: (q) => q.queryKey[0] === prefix
    })
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
