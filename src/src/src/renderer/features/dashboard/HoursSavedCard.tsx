import { useQuery } from '@tanstack/react-query'
import { Zap, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { formatNumber } from '@/lib/utils'
import { useCountUp } from '@/hooks/use-count-up'

// Per-duplicate cost estimate. A mid-size PDF through topic generation takes
// roughly 3 minutes on a consumer GPU; peer dedup skips that work entirely.
const MINUTES_SAVED_PER_DUP = 3

export function HoursSavedCard(): JSX.Element {
  const { data } = useQuery({
    queryKey: ['dedupSummary'],
    queryFn: () => api.insights.dedupSummary(),
    refetchInterval: 30_000
  })

  const duplicatesAvoided = data ? data.totalDocs - data.uniqueMasterIds : 0
  const targetHours = Math.max(0, Math.round((duplicatesAvoided * MINUTES_SAVED_PER_DUP) / 60))
  const displayedHours = useCountUp(targetHours, 1400)
  const equivalentDays = Math.round((targetHours / 24) * 10) / 10

  return (
    <Card className="relative overflow-hidden border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-emerald-500/15 blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-4 -bottom-8 h-28 w-28 rounded-full bg-primary/15 blur-2xl"
      />
      <CardContent className="relative flex flex-col gap-2 p-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
          <Zap className="h-3.5 w-3.5" />
          Hours saved by peer dedup
        </div>

        {!data ? (
          <Skeleton className="h-16 w-48" />
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="bg-gradient-to-r from-emerald-500 to-primary bg-clip-text text-5xl font-bold tabular-nums tracking-tight text-transparent">
              {formatNumber(displayedHours)}
            </span>
            <span className="text-lg font-semibold text-muted-foreground">hrs</span>
          </div>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            ≈ {equivalentDays} {equivalentDays === 1 ? 'day' : 'days'} of processing
          </span>
          <span className="text-muted-foreground/70">·</span>
          <span>
            {formatNumber(duplicatesAvoided)} duplicate{duplicatesAvoided === 1 ? '' : 's'} avoided
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
