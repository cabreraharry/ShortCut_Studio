import { useQuery } from '@tanstack/react-query'
import { BarChart3 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import { formatNumber } from '@/lib/utils'

export function TopicDistributionChart(): JSX.Element {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['topicDistribution'],
    queryFn: () => api.topics.distribution()
  })

  const max = rows.reduce((m, r) => Math.max(m, r.fileCount), 1)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Topic distribution
        </CardTitle>
        <CardDescription>
          Top topics across your library. Synthetic counts for v1 — real data wires in when TopicStat&apos;s /query endpoint lands.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No distribution data yet.</p>
        ) : (
          <div className="space-y-1.5">
            {rows.map((r) => {
              const pct = (r.fileCount / max) * 100
              return (
                <div key={r.topic} className="flex items-center gap-3 text-xs">
                  <div className="w-44 truncate text-right text-muted-foreground" title={r.topic}>
                    {r.topic}
                  </div>
                  <div className="relative h-4 flex-1 overflow-hidden rounded bg-muted/40">
                    <div
                      className="h-full rounded bg-primary/70 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="w-12 text-right font-mono tabular-nums text-muted-foreground">
                    {formatNumber(r.fileCount)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
