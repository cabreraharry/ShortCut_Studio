import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Moon, Sun, Activity, HelpCircle, Sparkles } from 'lucide-react'
import { IconButton } from '@/components/ui/icon-button'
import { Tip } from '@/components/ui/cursor-tooltip'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { APP_VERSION, APP_BUILD_DATE } from '@/lib/app-info'
import { AboutDialog } from './AboutDialog'
import type { DataSource, DataSourceState, UpdaterStatus } from '@shared/types'

// Persist the theme toggle across restarts. Renderer-only state, so
// localStorage is the right tool — no IPC roundtrip, no DB schema bump,
// instant read on mount. Initial value reads from storage; absent key falls
// back to dark (the app's intended default per CLAUDE.md).
const THEME_STORAGE_KEY = 'scs.theme'

function readStoredTheme(): boolean {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (raw === 'dark') return true
    if (raw === 'light') return false
  } catch {
    // localStorage can throw in odd Electron sandbox states; fall through.
  }
  return true
}

function useTheme() {
  const [isDark, setIsDark] = useState<boolean>(readStoredTheme)
  useEffect(() => {
    const root = document.documentElement
    if (isDark) root.classList.add('dark')
    else root.classList.remove('dark')
    try {
      localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light')
    } catch {
      // ignore persistence failure; in-memory toggle still works
    }
  }, [isDark])
  return { isDark, toggle: () => setIsDark((v) => !v) }
}

export function Header() {
  const { isDark, toggle } = useTheme()
  const [aboutOpen, setAboutOpen] = useState(false)

  const { data: jobs = [] } = useQuery({
    queryKey: ['progress-jobs'],
    queryFn: () => api.progress.jobs(),
    refetchInterval: 5000
  })

  const runningJobs = jobs.filter((j) => j.status === 'running').length
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card/60 px-4 backdrop-blur">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Wordmark />
          <Tip content={`ShortCut Studio v${APP_VERSION} · built ${APP_BUILD_DATE}`}>
            <span className="cursor-default text-xs font-normal text-muted-foreground">
              v{APP_VERSION}
            </span>
          </Tip>
        </div>
        <div className="hidden items-center gap-1.5 md:flex">
          <Tip
            content={
              runningJobs > 0
                ? `${runningJobs} background job${runningJobs === 1 ? '' : 's'} currently running`
                : 'No background jobs running right now'
            }
          >
            <span>
              <StatusChip
                icon={<Activity className="h-3 w-3" />}
                label={runningJobs > 0 ? `${runningJobs} running` : 'idle'}
                active={runningJobs > 0}
              />
            </span>
          </Tip>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <UpdateAvailablePill />
        <DataSourcePill />
        <IconButton
          tip="About ShortCut Studio"
          onClick={() => setAboutOpen(true)}
        >
          <HelpCircle className="h-4 w-4" />
        </IconButton>
        <IconButton
          tip={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={toggle}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </IconButton>
      </div>
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </header>
  )
}

// Tiny pill that surfaces an "Update available" affordance from the header.
// Hidden when the updater is idle / up-to-date / errored — only the
// 'update-available' state shows it. Clicking jumps to Settings → Updates.
function UpdateAvailablePill(): JSX.Element | null {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: status } = useQuery<UpdaterStatus>({
    queryKey: ['updater-status'],
    queryFn: () => api.updater.status()
  })

  // Subscribe to push events from main so the header reacts to background
  // checks without needing its own polling timer.
  useEffect(() => {
    const off = api.updater.onStatusChanged((next) => {
      qc.setQueryData(['updater-status'], next)
    })
    return off
  }, [qc])

  if (status?.state !== 'update-available') return null

  return (
    <Tip content={`v${status.availableVersion} is available — click for details`}>
      <button
        type="button"
        onClick={() => navigate('/settings')}
        className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 transition-colors hover:bg-amber-500/20 dark:text-amber-400"
      >
        <Sparkles className="h-3 w-3" />
        Update ready
      </button>
    </Tip>
  )
}

function DataSourcePill(): JSX.Element {
  const qc = useQueryClient()
  const { data } = useQuery<DataSourceState>({
    queryKey: ['dataSource'],
    queryFn: () => api.dataSource.get()
  })
  const setSource = useMutation({
    mutationFn: (next: DataSource) => api.dataSource.set(next),
    onSuccess: (state) => {
      qc.setQueryData(['dataSource'], state)
      qc.invalidateQueries()
    }
  })

  const current: DataSource = data?.current ?? 'demo'
  const prodAvailable = data?.prodAvailable ?? false

  const segmentClass = (active: boolean): string =>
    cn(
      'px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors',
      active
        ? 'bg-primary/20 text-primary'
        : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground'
    )

  return (
    <div
      role="radiogroup"
      aria-label="Data source"
      className="inline-flex overflow-hidden rounded-full border border-border bg-muted/30"
    >
      <Tip content="Synthetic data for demonstration">
        <button
          type="button"
          role="radio"
          aria-checked={current === 'demo'}
          onClick={() => setSource.mutate('demo')}
          className={segmentClass(current === 'demo')}
        >
          Demo
        </button>
      </Tip>
      <Tip
        content={
          prodAvailable
            ? 'Live data from the real backend'
            : 'Production backend not yet available — staying in Demo'
        }
      >
        <button
          type="button"
          role="radio"
          aria-checked={current === 'prod'}
          disabled={!prodAvailable}
          onClick={() => prodAvailable && setSource.mutate('prod')}
          className={cn(
            segmentClass(current === 'prod'),
            !prodAvailable && 'cursor-not-allowed opacity-50 hover:bg-transparent hover:text-muted-foreground'
          )}
        >
          Prod
        </button>
      </Tip>
    </div>
  )
}

function Wordmark(): JSX.Element {
  return (
    <span className="flex items-center gap-2">
      <WordmarkGlyph />
      <span className="text-base font-semibold tracking-tight">
        <span className="bg-gradient-to-r from-glass-local via-primary to-glass-peer bg-clip-text text-transparent">
          ShortCut
        </span>{' '}
        Studio
      </span>
    </span>
  )
}

function WordmarkGlyph(): JSX.Element {
  return (
    <svg viewBox="0 0 20 24" className="h-7 w-6" aria-hidden="true">
      <defs>
        <linearGradient id="wm-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--glass-peer))" />
          <stop offset="100%" stopColor="hsl(var(--glass-local))" />
        </linearGradient>
      </defs>
      <path
        d="M 5 2 L 15 2 L 15 4 L 17 6 L 17 19 A 3 3 0 0 1 14 22 L 6 22 A 3 3 0 0 1 3 19 L 3 6 L 5 4 Z"
        fill="url(#wm-grad)"
        fillOpacity="0.85"
      />
      <rect x="5" y="13" width="10" height="8" fill="hsl(var(--glass-local))" fillOpacity="0.9" />
    </svg>
  )
}

function StatusChip({
  icon,
  label,
  active
}: {
  icon: React.ReactNode
  label: string
  active: boolean
}): JSX.Element {
  const toneClass = active
    ? 'border-glass-local/50 bg-glass-local/15 text-glass-local'
    : 'border-border bg-muted/30 text-muted-foreground'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
        toneClass
      )}
    >
      {active && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-glass-local opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-glass-local" />
        </span>
      )}
      {icon}
      {label}
    </span>
  )
}
