import { useQuery } from '@tanstack/react-query'
import { Copy, Layers, Sparkles } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ColorfulStat } from '@/components/visual/ColorfulStat'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { formatNumber } from '@/lib/utils'

export function DedupCard(): JSX.Element {
  const { data } = useQuery({
    queryKey: ['dedupSummary'],
    queryFn: () => api.insights.dedupSummary(),
    refetchInterval: 30_000
  })

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Copy className="h-4 w-4" />
          Duplicates
        </CardTitle>
        <CardDescription>
          How many of your files are already in the network. When a peer has scanned the same paper, the
          work is shared — you don&apos;t pay to process it again.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!data ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <ColorfulStat
              label="Total docs"
              value={formatNumber(data.totalDocs)}
              tone="muted"
              icon={<Layers className="h-4 w-4" />}
            />
            <ColorfulStat
              label="Unique files"
              value={formatNumber(data.uniqueMasterIds)}
              tone="primary"
              icon={<Copy className="h-4 w-4" />}
            />
            <ColorfulStat
              label="Shared with network"
              value={`${data.dedupPct}%`}
              sublabel="of your files are already processed by peers"
              tone="success"
              icon={<Sparkles className="h-4 w-4" />}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
