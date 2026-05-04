import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PartyPopper, ArrowRight, X } from 'lucide-react'

// One-time scan-completion celebration. Renders when the user crosses 100%
// for the first time at a given (totalFiles, processedTotal) pair. Persisted
// dismissal is keyed off the file count so a fresh batch of imports — which
// resets the percentage below 100% and back up — gets its own banner.
//
// Without this, hitting 100% was a 700ms emerald sparkle behind a static
// "100%" — easy to miss when tabbed away. The Peak-End rule says the user
// remembers the high points and the ending; making the high point visible
// is the cheapest way to swing that sentiment.

const STORAGE_KEY_PREFIX = 'scs.dashboard.celebrationDismissed.'

interface CelebrationBannerProps {
  totalFiles: number
  processedTotal: number
}

export function CelebrationBanner({
  totalFiles,
  processedTotal
}: CelebrationBannerProps): JSX.Element | null {
  const navigate = useNavigate()
  // Key is total + processed so a re-import that pushes total higher (now
  // < 100% again) gets its own celebration when it eventually re-completes.
  const dismissalKey = `${STORAGE_KEY_PREFIX}${totalFiles}.${processedTotal}`
  // `tick` forces a re-derivation of `dismissed` after the user clicks X.
  // Reading localStorage live in `useMemo` avoids the one-frame stale-state
  // window that a `useState` + `useEffect` combo would have when the key
  // changes on a refetch (the next render would still read the old default
  // until the effect fires).
  const [tick, setTick] = useState(0)
  const dismissed = useMemo(() => {
    try {
      return typeof window !== 'undefined' && window.localStorage.getItem(dismissalKey) === '1'
    } catch {
      return false
    }
    // Tick is a deliberate dep so handleDismiss's setTick triggers a re-read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissalKey, tick])

  // Only fire when the library has at least one file and the user has
  // genuinely completed it. < 1 file = first-run state, handled elsewhere.
  if (totalFiles < 1 || processedTotal < totalFiles) return null
  if (dismissed) return null

  const handleDismiss = (): void => {
    try {
      window.localStorage.setItem(dismissalKey, '1')
    } catch {
      // localStorage disabled — degrade to in-memory only via the tick
      // counter; banner reappears on next mount which is acceptable.
    }
    setTick((n) => n + 1)
  }

  return (
    <section className="relative overflow-hidden rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-400/5 to-emerald-500/10 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            <PartyPopper className="h-5 w-5" />
          </span>
          <div className="space-y-0.5">
            <h2 className="text-base font-semibold tracking-tight">
              Library complete — {totalFiles.toLocaleString()} files processed
            </h2>
            <p className="text-sm text-muted-foreground">
              Topics + summaries are ready to review.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/topics')}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400"
          >
            Review topics
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  )
}
