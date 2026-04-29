import { useQuery } from '@tanstack/react-query'
import { DollarSign } from 'lucide-react'
import { api } from '@/lib/api'

/**
 * Inline "Today: $X.XX" display for the OpenAI provider card. Fetches the
 * undocumented `/v1/usage` endpoint via the main-process IPC. Hides itself
 * silently on any failure — the dashboard-link button is the always-working
 * primary surface; this is bonus polish.
 *
 * `staleTime: 60_000` keeps re-mounts cheap without hammering the endpoint.
 */
export function OpenAiUsageInline({ providerId }: { providerId: number }): JSX.Element | null {
  const { data } = useQuery({
    queryKey: ['openai-usage-today', providerId],
    queryFn: () => api.llm.fetchOpenAiUsage(providerId),
    staleTime: 60_000,
    // Don't retry on errors — the renderer treats all failures as "hide".
    retry: false
  })

  if (!data || !data.ok || data.usdToday === undefined) return null

  return (
    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
      <DollarSign className="h-3 w-3" />
      <span>
        Today: <span className="font-mono text-foreground">${data.usdToday.toFixed(2)}</span>
      </span>
      <span className="opacity-60">(via OpenAI usage API)</span>
    </div>
  )
}
