import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { HardDrive, Share2, ShoppingCart, ExternalLink, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { formatNumber } from '@/lib/utils'
import { ColorfulStat } from '@/components/visual/ColorfulStat'
import { PeerNetwork } from '@/components/visual/PeerNetwork'
import { AllocationDisc } from '@/components/visual/AllocationDisc'
import { Hero } from '@/components/visual/Hero'
import { useCountUp } from '@/hooks/use-count-up'
import { HelpHint } from '@/components/ui/help-hint'

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

      <CommunityHero />

      <Card className="border-amber-500/50 bg-amber-500/10 dark:border-amber-500/20 dark:bg-amber-500/5">
        <CardContent className="flex gap-3 p-4 text-sm">
          <Share2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" />
          <div>
            <div className="font-semibold text-amber-900 dark:text-amber-300">
              Community features are not wired to the backend yet
            </div>
            <div className="mt-1 text-amber-800/90 dark:text-amber-100/80">
              The interface is live, but no real IPFS daemon or peer exchange is running in v1. When ExecEngine&apos;s consumer layer lands, the controls below drive real allocation.
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,300px)]">
        <PeerNetwork peerCount={status?.peerCount ?? 0} />
        <div className="grid grid-rows-2 gap-3">
          <ColorfulStat
            label={
              <>
                Stored locally
                <HelpHint
                  size="xs"
                  label="Bytes that the IPFS node has cached on this PC, including pieces fetched from peers. Always 0 in v1 — controls are inert until ExecEngine ships its IPFS layer."
                />
              </>
            }
            value={status ? `${bytesToGb(status.storedBytes).toFixed(2)} GB` : '—'}
            tone="local"
            icon={<HardDrive className="h-4 w-4" />}
            className="h-full"
          />
          <ColorfulStat
            label={
              <>
                Shared with peers
                <HelpHint
                  size="xs"
                  label="Bytes of YOUR processed data that other peers have pulled from this PC. Always 0 in v1."
                />
              </>
            }
            value={status ? `${bytesToGb(status.sharedBytes).toFixed(2)} GB` : '—'}
            tone="primary"
            icon={<Share2 className="h-4 w-4" />}
            className="h-full"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Disk allocation
            <HelpHint
              size="sm"
              label="The disk budget you're willing to give the SCL peer network for storing OTHER PEOPLE'S processed metadata (topics, embeddings, summaries — never their original files). In return, your own metadata gets faster propagation. Minimum is computed from your library size; max is 500 GB. v1: persisted to settings but not yet enforced."
            />
          </CardTitle>
          <CardDescription>
            How much space you&apos;ll dedicate to community-shared processing results. Minimum calculated from your own scanned files.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
            <AllocationDisc
              current={draft}
              max={500}
              label={`of 500 GB max`}
            />
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Slide to allocate</span>
                  <span className="font-mono text-sm text-primary">{draft} GB</span>
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
            </div>
          </div>
        </CardContent>
      </Card>

      <PersuasionCards />
    </div>
  )
}

const MINUTES_SAVED_PER_DUP = 3

function CommunityHero(): JSX.Element {
  const { data: summary } = useQuery({
    queryKey: ['progress-summary', 'all'],
    queryFn: () => api.progress.summary('all'),
    refetchInterval: 10_000
  })
  const { data: dedup } = useQuery({
    queryKey: ['dedupSummary'],
    queryFn: () => api.insights.dedupSummary(),
    refetchInterval: 30_000
  })

  const filesForYou = summary?.processedPeer ?? 0
  const displayedFiles = useCountUp(filesForYou, 1200)
  const dupCount = dedup ? dedup.totalDocs - dedup.uniqueMasterIds : 0
  const hoursSaved = Math.max(0, Math.round((dupCount * MINUTES_SAVED_PER_DUP) / 60))
  const sharedPct = dedup?.dedupPct ?? 0

  return (
    <Hero
      tone="community"
      title={
        <span className="flex flex-wrap items-baseline gap-2">
          <Sparkles className="h-5 w-5 text-glass-peer" />
          <span className="bg-gradient-to-r from-glass-peer to-primary bg-clip-text text-transparent">
            {formatNumber(displayedFiles)}
          </span>
          <span>files processed for you</span>
        </span>
      }
      subtitle={
        <span>
          <span className="font-semibold text-foreground">{formatNumber(hoursSaved)} hours saved</span>
          {' · '}
          <span className="font-semibold text-foreground">{sharedPct}%</span> of your library already shared with the network
        </span>
      }
      visual={<MiniPeerConstellation />}
      about={<CommunityHeroAbout />}
    />
  )
}

function MiniPeerConstellation(): JSX.Element {
  // A quiet echo of the full PeerNetwork: YOU in the middle, 5 peers orbiting.
  return (
    <svg viewBox="0 0 140 140" className="h-28 w-28 md:h-32 md:w-32" aria-hidden>
      <defs>
        <radialGradient id="mini-peer-orb" cx="35%" cy="35%" r="60%">
          <stop offset="0%" stopColor="white" stopOpacity="0.4" />
          <stop offset="40%" stopColor="hsl(var(--glass-peer))" stopOpacity="1" />
          <stop offset="100%" stopColor="hsl(var(--glass-peer))" stopOpacity="0.55" />
        </radialGradient>
        <radialGradient id="mini-self-orb" cx="35%" cy="35%" r="60%">
          <stop offset="0%" stopColor="white" stopOpacity="0.6" />
          <stop offset="40%" stopColor="hsl(var(--glass-local))" stopOpacity="1" />
          <stop offset="100%" stopColor="hsl(var(--glass-local))" stopOpacity="0.6" />
        </radialGradient>
      </defs>
      {[
        { cx: 70, cy: 18 },
        { cx: 118, cy: 50 },
        { cx: 100, cy: 110 },
        { cx: 40, cy: 110 },
        { cx: 22, cy: 50 }
      ].map((p, i) => (
        <g key={i}>
          <line
            x1={70}
            y1={70}
            x2={p.cx}
            y2={p.cy}
            stroke="hsl(var(--glass-peer))"
            strokeOpacity="0.35"
            strokeWidth="0.8"
          />
          <circle cx={p.cx} cy={p.cy} r="5" fill="url(#mini-peer-orb)" />
        </g>
      ))}
      <circle cx={70} cy={70} r="10" fill="url(#mini-self-orb)" />
    </svg>
  )
}

function CommunityHeroAbout(): JSX.Element {
  return (
    <div className="space-y-3 text-muted-foreground">
      <p>
        When a peer on the network scans a paper your copy also contains, ExecEngine links both
        files to the same <span className="font-mono text-[11px]">MasterID</span> so your machine
        doesn&apos;t re-run topic generation, reference extraction, or OCR on it. The work they
        already paid for becomes your work — for free.
      </p>
      <p>
        You reciprocate automatically: every unique file you scan enters the network for the next
        peer who has it. No content is shared — only the <em>results</em> of processing it.
      </p>
      <ul className="list-disc space-y-0.5 pl-5 text-xs">
        <li>Your documents never leave your machine.</li>
        <li>Peers see only anonymized DocIDs + topic labels.</li>
        <li>Allocated disk space below is used for the shared-results cache.</li>
      </ul>
    </div>
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
