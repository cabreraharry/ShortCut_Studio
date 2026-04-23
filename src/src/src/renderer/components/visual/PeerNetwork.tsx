interface Node {
  id: string
  cx: number
  cy: number
  r: number
  isSelf?: boolean
  active?: boolean
}

// Clean peer network — YOU at center, 14 peers scattered organically around it.
// Every peer links to YOU + a couple of nearest neighbors. Varied distances &
// angles (no ring). Two peers offline.
const NODES: Node[] = [
  { id: 'me', cx: 200, cy: 135, r: 14, isSelf: true, active: true },
  // Near peers (closer to YOU)
  { id: 'n1', cx: 145, cy: 90, r: 5, active: true },
  { id: 'n2', cx: 260, cy: 95, r: 5, active: true },
  { id: 'n3', cx: 265, cy: 170, r: 5, active: true },
  { id: 'n4', cx: 135, cy: 175, r: 5, active: true },
  // Mid peers
  { id: 'p1', cx: 80, cy: 60, r: 6, active: true },
  { id: 'p2', cx: 195, cy: 45, r: 6, active: true },
  { id: 'p3', cx: 310, cy: 60, r: 6, active: false },
  { id: 'p4', cx: 340, cy: 140, r: 6, active: true },
  { id: 'p5', cx: 305, cy: 220, r: 6, active: true },
  { id: 'p6', cx: 195, cy: 235, r: 6, active: true },
  { id: 'p7', cx: 85, cy: 215, r: 6, active: true },
  { id: 'p8', cx: 55, cy: 140, r: 6, active: true },
  // Far peers (edge of network)
  { id: 'f1', cx: 30, cy: 50, r: 5, active: false },
  { id: 'f2', cx: 370, cy: 195, r: 5, active: true }
]

const LINKS: Array<[string, string]> = [
  // Every peer connects to YOU — YOU is the center hub
  ['me', 'n1'], ['me', 'n2'], ['me', 'n3'], ['me', 'n4'],
  ['me', 'p1'], ['me', 'p2'], ['me', 'p3'], ['me', 'p4'],
  ['me', 'p5'], ['me', 'p6'], ['me', 'p7'], ['me', 'p8'],
  // Peer-to-peer neighbor bonds — the "mesh" layer
  ['n1', 'p1'], ['n1', 'p2'], ['n2', 'p2'], ['n2', 'p3'], ['n2', 'p4'],
  ['n3', 'p4'], ['n3', 'p5'], ['n3', 'p6'],
  ['n4', 'p6'], ['n4', 'p7'], ['n4', 'p8'],
  ['n1', 'p8'], ['p1', 'p2'], ['p2', 'p3'], ['p3', 'p4'],
  ['p4', 'p5'], ['p5', 'p6'], ['p6', 'p7'], ['p7', 'p8'], ['p8', 'p1'],
  // Edge peers hang off nearest mid peer
  ['p1', 'f1'], ['f1', 'p8'], ['p4', 'f2'], ['p5', 'f2']
]

export function PeerNetwork({ peerCount = 8 }: { peerCount?: number }): JSX.Element {
  const nodeById = new Map(NODES.map((n) => [n.id, n]))
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-glass-peer/10 via-transparent to-primary/10 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Peer network</div>
          <div className="text-xs text-muted-foreground">
            {peerCount > 0 ? `${peerCount} peer${peerCount === 1 ? '' : 's'} reachable` : 'No peers yet — start ExecEngine to join'}
          </div>
        </div>
      </div>
      <svg viewBox="0 0 400 270" className="h-44 w-full" aria-hidden="true">
        <defs>
          {/* Ambient fog backdrop — subtle radial gradients hinting at depth */}
          <radialGradient id="pn-fog-a" cx="25%" cy="30%" r="40%">
            <stop offset="0%" stopColor="hsl(var(--glass-peer))" stopOpacity="0.12" />
            <stop offset="100%" stopColor="hsl(var(--glass-peer))" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="pn-fog-b" cx="80%" cy="75%" r="45%">
            <stop offset="0%" stopColor="hsl(var(--glass-local))" stopOpacity="0.1" />
            <stop offset="100%" stopColor="hsl(var(--glass-local))" stopOpacity="0" />
          </radialGradient>
          {/* Node orbs — radial gradient for depth */}
          <radialGradient id="pn-peer-orb" cx="35%" cy="35%" r="60%">
            <stop offset="0%" stopColor="white" stopOpacity="0.3" />
            <stop offset="30%" stopColor="hsl(var(--glass-peer))" stopOpacity="1" />
            <stop offset="100%" stopColor="hsl(var(--glass-peer))" stopOpacity="0.5" />
          </radialGradient>
          <radialGradient id="pn-local-orb" cx="35%" cy="35%" r="60%">
            <stop offset="0%" stopColor="white" stopOpacity="0.4" />
            <stop offset="30%" stopColor="hsl(var(--glass-local))" stopOpacity="1" />
            <stop offset="100%" stopColor="hsl(var(--glass-local))" stopOpacity="0.55" />
          </radialGradient>
          {/* Link gradient */}
          <linearGradient id="pn-link" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(var(--glass-peer))" stopOpacity="0.1" />
            <stop offset="50%" stopColor="hsl(var(--glass-peer))" stopOpacity="0.7" />
            <stop offset="100%" stopColor="hsl(var(--glass-peer))" stopOpacity="0.1" />
          </linearGradient>
          {/* Soft glow filter */}
          <filter id="pn-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Fog backdrop */}
        <rect width="400" height="270" fill="url(#pn-fog-a)" />
        <rect width="400" height="270" fill="url(#pn-fog-b)" />

        {/* Links — every edge treated equally. No hub-and-spoke bias. */}
        <g>
          {LINKS.map(([a, b], i) => {
            const A = nodeById.get(a)!
            const B = nodeById.get(b)!
            const both = A.active && B.active
            return (
              <line
                key={i}
                x1={A.cx}
                y1={A.cy}
                x2={B.cx}
                y2={B.cy}
                stroke="hsl(var(--glass-peer))"
                strokeOpacity={both ? 0.32 : 0.09}
                strokeWidth={0.9}
              />
            )
          })}
        </g>

        {/* Data packets scatter across active edges everywhere in the mesh —
            not just YOU's connections, because real peers route to each other. */}
        <g>
          {LINKS.filter(([a, b]) => {
            const A = nodeById.get(a)!
            const B = nodeById.get(b)!
            return A.active && B.active
          })
            .filter((_, i) => i % 4 === 0)
            .slice(0, 14)
            .map(([a, b], i) => {
              const A = nodeById.get(a)!
              const B = nodeById.get(b)!
              return (
                <circle
                  key={`pkt-${i}`}
                  r="1.8"
                  fill="hsl(var(--glass-peer))"
                  style={{
                    offsetPath: `path('M ${A.cx} ${A.cy} L ${B.cx} ${B.cy}')`,
                    animation: `packetFlow ${3 + (i % 5) * 0.5}s linear ${(i * 0.42).toFixed(2)}s infinite`
                  }}
                />
              )
            })}
        </g>

        {/* Nodes with glow */}
        <g filter="url(#pn-glow)">
          {NODES.map((n, i) => {
            const fill = n.isSelf
              ? 'url(#pn-local-orb)'
              : n.active
                ? 'url(#pn-peer-orb)'
                : 'hsl(var(--muted-foreground))'
            return (
              <g key={n.id}>
                {n.active && !n.isSelf && (
                  <circle
                    cx={n.cx}
                    cy={n.cy}
                    r={n.r + 5}
                    fill="hsl(var(--glass-peer))"
                    fillOpacity="0.18"
                    style={{
                      animation: `peerNodePulse 2.8s ease-in-out ${(i * 0.22).toFixed(2)}s infinite`,
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
                {n.isSelf && (
                  <text
                    x={n.cx}
                    y={n.cy + 4}
                    textAnchor="middle"
                    className="fill-white"
                    style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em' }}
                  >
                    YOU
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>
      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-glass-local" /> You
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-glass-peer" /> Active peer
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/60" /> Offline
        </span>
      </div>
    </div>
  )
}
