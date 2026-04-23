import { useQuery } from '@tanstack/react-query'
import { Sparkles, TrendingUp, Users } from 'lucide-react'
import { api } from '@/lib/api'
import { formatNumber } from '@/lib/utils'
import { Hero } from './Hero'

export function DashboardHeroBanner(): JSX.Element {
  const { data: summary } = useQuery({
    queryKey: ['progress-summary', '5d'],
    queryFn: () => api.progress.summary('5d')
  })
  const { data: dedup } = useQuery({
    queryKey: ['dedupSummary'],
    queryFn: () => api.insights.dedupSummary()
  })

  const weekProcessed = summary?.deltaLocal ?? 0
  const peerRank = dedup ? Math.max(3, 20 - Math.floor(dedup.uniqueMasterIds / 200)) : 14

  return (
    <Hero
      tone="primary"
      title={
        summary ? (
          <span className="flex flex-wrap items-baseline gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="bg-gradient-to-r from-primary to-glass-peer bg-clip-text font-mono text-transparent">
              {formatNumber(weekProcessed)}
            </span>
            <span>papers processed this week</span>
          </span>
        ) : (
          'Your library at a glance'
        )
      }
      subtitle={
        <div className="space-y-3">
          <p>
            You&apos;re <span className="font-semibold text-foreground">#{peerRank}</span> in the peer
            network. Every new scan helps the community avoid redoing your work.
          </p>
          <div className="flex flex-wrap gap-2">
            <HeroChip
              icon={<TrendingUp className="h-3 w-3" />}
              label={summary ? `+${formatNumber(summary.deltaLocal)} local` : 'local'}
              tone="local"
            />
            <HeroChip
              icon={<Users className="h-3 w-3" />}
              label={summary ? `+${formatNumber(summary.deltaPeer)} peer` : 'peer'}
              tone="peer"
            />
            {dedup && (
              <HeroChip
                icon={<Sparkles className="h-3 w-3" />}
                label={`${dedup.dedupPct}% shared w/ network`}
                tone="accent"
              />
            )}
          </div>
        </div>
      }
      visual={<HeroArt />}
    />
  )
}

function HeroChip({
  icon,
  label,
  tone
}: {
  icon: React.ReactNode
  label: string
  tone: 'local' | 'peer' | 'accent'
}): JSX.Element {
  const classes =
    tone === 'local'
      ? 'border-glass-local/50 bg-glass-local/15 text-glass-local'
      : tone === 'peer'
        ? 'border-glass-peer/50 bg-glass-peer/15 text-glass-peer'
        : 'border-primary/40 bg-primary/15 text-primary'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${classes}`}>
      {icon}
      {label}
    </span>
  )
}

// Clean peer network — YOU at center, 10 peers scattered organically around it.
// Each peer connects to YOU + 1-2 nearest neighbors. Positions irregular so
// no symmetric ring appears. Two peers offline (dim grey).
const HERO_NODES: Array<{
  id: string
  cx: number
  cy: number
  r: number
  active: boolean
  self?: boolean
}> = [
  { id: 'me', cx: 145, cy: 85, r: 10, active: true, self: true },
  // Scattered peers at varied distances + angles (no ring symmetry)
  { id: 'p1', cx: 55, cy: 40, r: 5, active: true },
  { id: 'p2', cx: 105, cy: 25, r: 4, active: true },
  { id: 'p3', cx: 195, cy: 30, r: 5, active: true },
  { id: 'p4', cx: 250, cy: 50, r: 4, active: false },
  { id: 'p5', cx: 90, cy: 70, r: 4, active: true },
  { id: 'p6', cx: 205, cy: 75, r: 5, active: true },
  { id: 'p7', cx: 25, cy: 95, r: 4, active: true },
  { id: 'p8', cx: 265, cy: 115, r: 5, active: true },
  { id: 'p9', cx: 75, cy: 135, r: 4, active: true },
  { id: 'p10', cx: 150, cy: 150, r: 5, active: true },
  { id: 'p11', cx: 215, cy: 145, r: 4, active: false }
]

// Each peer connects to YOU + 1-2 of its nearest neighbors (local mesh).
const HERO_LINKS: Array<[string, string]> = [
  // Everyone links to YOU
  ['me', 'p1'], ['me', 'p2'], ['me', 'p3'], ['me', 'p4'],
  ['me', 'p5'], ['me', 'p6'], ['me', 'p7'], ['me', 'p8'],
  ['me', 'p9'], ['me', 'p10'], ['me', 'p11'],
  // Peer-to-peer neighbor bonds (organic, not ring-like)
  ['p1', 'p2'], ['p2', 'p3'], ['p3', 'p4'],
  ['p1', 'p5'], ['p2', 'p5'], ['p3', 'p6'], ['p4', 'p6'],
  ['p1', 'p7'], ['p5', 'p9'], ['p6', 'p8'], ['p4', 'p8'],
  ['p7', 'p9'], ['p9', 'p10'], ['p10', 'p11'], ['p8', 'p11']
]

function HeroArt(): JSX.Element {
  const byId = new Map(HERO_NODES.map((n) => [n.id, n]))
  // Data packets travel along many edges randomly across the whole network
  // (not just spokes from YOU) — gives the mesh a living-traffic feel.
  const packetLinks = HERO_LINKS.filter(([a, b]) => {
    const A = byId.get(a)!
    const B = byId.get(b)!
    return A.active && B.active
  }).filter((_, i) => i % 3 === 0).slice(0, 10)

  return (
    <svg
      viewBox="0 0 290 175"
      className="hidden h-40 w-72 shrink-0 md:block"
      aria-hidden="true"
    >
      <defs>
        <filter id="hero-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="hero-peer-orb" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="white" stopOpacity="0.35" />
          <stop offset="30%" stopColor="hsl(var(--glass-peer))" stopOpacity="1" />
          <stop offset="100%" stopColor="hsl(var(--glass-peer))" stopOpacity="0.5" />
        </radialGradient>
        <radialGradient id="hero-local-orb" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="white" stopOpacity="0.45" />
          <stop offset="30%" stopColor="hsl(var(--glass-local))" stopOpacity="1" />
          <stop offset="100%" stopColor="hsl(var(--glass-local))" stopOpacity="0.55" />
        </radialGradient>
      </defs>

      {/* Links — every edge gets the same treatment. No hub-and-spoke bias. */}
      <g>
        {HERO_LINKS.map(([a, b], i) => {
          const A = byId.get(a)!
          const B = byId.get(b)!
          const both = A.active && B.active
          return (
            <line
              key={i}
              x1={A.cx}
              y1={A.cy}
              x2={B.cx}
              y2={B.cy}
              stroke="hsl(var(--glass-peer))"
              strokeOpacity={both ? 0.3 : 0.08}
              strokeWidth={0.8}
            />
          )
        })}
      </g>

      {/* Data packets drift along random edges across the whole mesh */}
      <g>
        {packetLinks.map(([a, b], i) => {
          const A = byId.get(a)!
          const B = byId.get(b)!
          return (
            <circle
              key={`pkt-${i}`}
              r="1.6"
              fill="hsl(var(--glass-peer))"
              style={{
                offsetPath: `path('M ${A.cx} ${A.cy} L ${B.cx} ${B.cy}')`,
                animation: `packetFlow ${3 + (i % 4) * 0.6}s linear ${(i * 0.55).toFixed(2)}s infinite`
              }}
            />
          )
        })}
      </g>

      {/* Nodes */}
      <g filter="url(#hero-glow)">
        {HERO_NODES.map((n, i) => {
          const fill = n.self
            ? 'url(#hero-local-orb)'
            : n.active
              ? 'url(#hero-peer-orb)'
              : 'hsl(var(--muted-foreground))'
          return (
            <g key={n.id}>
              {n.active && (
                <circle
                  cx={n.cx}
                  cy={n.cy}
                  r={n.r + 3}
                  fill={n.self ? 'hsl(var(--glass-local))' : 'hsl(var(--glass-peer))'}
                  fillOpacity="0.15"
                  style={{
                    animation: `peerNodePulse 3s ease-in-out ${(i * 0.14).toFixed(2)}s infinite`,
                    transformOrigin: `${n.cx}px ${n.cy}px`
                  }}
                />
              )}
              <circle
                cx={n.cx}
                cy={n.cy}
                r={n.r}
                fill={fill}
                fillOpacity={n.active ? 1 : 0.4}
              />
            </g>
          )
        })}
      </g>

      {/* YOU label inside the central node */}
      <text
        x="145"
        y="88"
        textAnchor="middle"
        className="fill-white"
        style={{ fontSize: 7, fontWeight: 700, letterSpacing: '0.08em' }}
      >
        YOU
      </text>
    </svg>
  )
}
