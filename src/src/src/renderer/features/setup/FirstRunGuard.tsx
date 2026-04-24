import { useEffect, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'

/**
 * On first load, fetches settings and redirects to /setup if SetupCompleted is
 * false. Shows a minimal spinner while the fetch is in flight to avoid a flash
 * of the dashboard before the redirect fires.
 */
export function FirstRunGuard({ children }: { children: ReactNode }): JSX.Element {
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.settings.get(),
    staleTime: 30_000
  })
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!settings) return
    if (!settings.setupCompleted && location.pathname !== '/setup') {
      navigate('/setup', { replace: true })
    }
  }, [settings, location.pathname, navigate])

  if (isLoading || !settings) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-primary/60" />
        <span className="ml-2">Loading…</span>
      </div>
    )
  }

  // If we're about to redirect, render nothing briefly.
  if (!settings.setupCompleted && location.pathname !== '/setup') {
    return <></>
  }

  return <>{children}</>
}
