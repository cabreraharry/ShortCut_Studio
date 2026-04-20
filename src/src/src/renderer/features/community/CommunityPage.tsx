import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { HardDrive, Users, Share2, ShoppingCart, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { formatNumber } from '@/lib/utils'

function bytesToGb(b: number) {
  return b / (1024 ** 3)
}

export default function CommunityPage() {
  const qc = useQueryClient()
  const { data: status } = useQuery({
    queryKey: ['ipfs-status'],
    queryFn: () => api.ipfs.status(),
    refetchInterval: 5000
  })
  const setAlloc = useMutation({
    mutationFn: (gb: number) => api.ipfs.setAllocation(gb),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ipfs-status'] })
  })
  const [draft, setDraft] = useState(0)

  useEffect(() => {
    if (status) setDraft(status.allocationGb || status.minAllocationGb)
  }, [status])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Community</h1>
        <p className="text-sm text-muted-foreground">
          Share storage and compute with other researchers. Your documents never leave your machine, but processing results are exchanged over IPFS to accelerate everyone's pipelines.
        </p>
      </div>

      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="flex gap-3 p-4 text-sm">
          <Share2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <div className="font-semibold text-amber-300">Community features are not wired to the backend yet</div>
            <div className="mt-1 text-amber-100/80">
              The interface is live, but no real IPFS daemon or peer exchange is running in v1. When ExecEngine's consumer layer lands, the controls below drive real allocation.
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <StatusTile
          icon={<Users className="h-4 w-4" />}
          label="Connected peers"
          value={status ? formatNumber(status.peerCount) : '—'}
        />
        <StatusTile
          icon={<HardDrive className="h-4 w-4" />}
          label="Stored locally"
          value={status ? `${bytesToGb(status.storedBytes).toFixed(2)} GB` : '—'}
        />
        <StatusTile
          icon={<Share2 className="h-4 w-4" />}
          label="Shared with peers"
          value={status ? `${bytesToGb(status.sharedBytes).toFixed(2)} GB` : '—'}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Disk allocation</CardTitle>
          <CardDescription>
            How much space you'll dedicate to community-shared processing results. Minimum calculated from your own scanned files.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Allocation</span>
              <span className="font-mono text-sm">{draft} GB</span>
            </div>
            <input
              type="range"
              min={status?.minAllocationGb ?? 8}
              max={500}
              value={draft}
              onChange={(e) => setDraft(Number(e.target.value))}
              onMouseUp={() => setAlloc.mutate(draft)}
              onTouchEnd={() => setAlloc.mutate(draft)}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>min: {status?.minAllocationGb ?? 8} GB</span>
              <span>max: 500 GB</span>
            </div>
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">Drive</label>
              <Input
                placeholder="D:\ (not yet configured)"
                disabled
                className="mt-1 font-mono text-xs"
              />
            </div>
            <Button variant="outline" disabled>
              Change drive
            </Button>
          </div>
        </CardContent>
      </Card>

      <PersuasionCards />
    </div>
  )
}

function StatusTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className="mt-1 font-mono text-xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  )
}

function PersuasionCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dedicate a full drive</CardTitle>
          <CardDescription>
            Pointing IPFS at its own drive means community content doesn't compete with your working files for IO or free space.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="outline">Recommended</Badge>
        </CardContent>
      </Card>
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="h-4 w-4" /> Need more storage?
          </CardTitle>
          <CardDescription>
            Partner eShops offer drives optimized for IPFS workloads. Affiliate links — picking one supports SCL's development.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" disabled>
            Shops <ExternalLink className="ml-1 h-3 w-3" />
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">Affiliate URLs pending — owner to supply.</p>
        </CardContent>
      </Card>
    </div>
  )
}
