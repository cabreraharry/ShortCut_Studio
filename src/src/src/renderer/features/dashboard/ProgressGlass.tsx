import { useMemo } from 'react'

interface ProgressGlassProps {
  localPct: number       // 0-100
  peerPct: number        // 0-100, stacked above local
  totalLabel?: string
}

export function ProgressGlass({ localPct, peerPct, totalLabel }: ProgressGlassProps) {
  const { localY, localH, peerY, peerH, totalPct } = useMemo(() => {
    const clampedLocal = Math.max(0, Math.min(100, localPct))
    const clampedPeer = Math.max(0, Math.min(100 - clampedLocal, peerPct))
    const total = clampedLocal + clampedPeer

    const innerTop = 30
    const innerBottom = 270
    const innerHeight = innerBottom - innerTop

    const localFillH = (clampedLocal / 100) * innerHeight
    const peerFillH = (clampedPeer / 100) * innerHeight

    return {
      totalPct: total,
      localY: innerBottom - localFillH,
      localH: localFillH,
      peerY: innerBottom - localFillH - peerFillH,
      peerH: peerFillH
    }
  }, [localPct, peerPct])

  return (
    <div className="relative inline-block">
      <svg
        viewBox="0 0 180 320"
        className="h-[320px] w-[180px]"
        aria-label="Progress Glass"
      >
        <defs>
          <clipPath id="glass-clip">
            <path
              d="
                M 40 20
                L 140 20
                L 140 40
                L 158 60
                L 158 265
                A 25 25 0 0 1 133 290
                L 47 290
                A 25 25 0 0 1 22 265
                L 22 60
                L 40 40
                Z"
            />
          </clipPath>
          <linearGradient id="local-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--glass-local))" stopOpacity="0.95" />
            <stop offset="100%" stopColor="hsl(var(--glass-local))" stopOpacity="0.75" />
          </linearGradient>
          <linearGradient id="peer-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--glass-peer))" stopOpacity="0.95" />
            <stop offset="100%" stopColor="hsl(var(--glass-peer))" stopOpacity="0.75" />
          </linearGradient>
        </defs>

        {/* Glass background (empty, subtle) */}
        <g clipPath="url(#glass-clip)">
          <rect x="0" y="0" width="180" height="320" className="fill-muted/15" />
        </g>

        {/* Peer liquid (top layer) */}
        <g clipPath="url(#glass-clip)">
          <rect
            x="0"
            y={peerY}
            width="180"
            height={peerH}
            fill="url(#peer-grad)"
            style={{ transition: 'y 600ms ease, height 600ms ease' }}
          />
          {/* Ripple accent at top of peer fill */}
          {peerH > 2 && (
            <line
              x1="0"
              y1={peerY}
              x2="180"
              y2={peerY}
              className="stroke-glass-peer"
              strokeWidth="1.5"
              strokeOpacity="0.6"
              style={{ transition: 'y1 600ms ease, y2 600ms ease' }}
            />
          )}
        </g>

        {/* Local liquid (bottom layer) */}
        <g clipPath="url(#glass-clip)">
          <rect
            x="0"
            y={localY}
            width="180"
            height={localH}
            fill="url(#local-grad)"
            style={{ transition: 'y 600ms ease, height 600ms ease' }}
          />
          {localH > 2 && peerH < 0.1 && (
            <line
              x1="0"
              y1={localY}
              x2="180"
              y2={localY}
              className="stroke-glass-local"
              strokeWidth="1.5"
              strokeOpacity="0.6"
              style={{ transition: 'y1 600ms ease, y2 600ms ease' }}
            />
          )}
        </g>

        {/* Glass outline */}
        <path
          d="
            M 40 20
            L 140 20
            L 140 40
            L 158 60
            L 158 265
            A 25 25 0 0 1 133 290
            L 47 290
            A 25 25 0 0 1 22 265
            L 22 60
            L 40 40
            Z"
          className="fill-none stroke-border"
          strokeWidth="2"
        />

        {/* Shine highlight on left */}
        <path
          d="M 32 70 L 32 250 A 18 18 0 0 0 45 268"
          className="fill-none stroke-white/20"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Total % centered */}
        <text
          x="90"
          y="165"
          textAnchor="middle"
          className="fill-foreground font-semibold"
          style={{ fontSize: 28 }}
        >
          {Math.round(totalPct)}%
        </text>
        {totalLabel && (
          <text
            x="90"
            y="185"
            textAnchor="middle"
            className="fill-muted-foreground"
            style={{ fontSize: 10 }}
          >
            {totalLabel}
          </text>
        )}
      </svg>

      {/* Legend */}
      <div className="mt-2 flex justify-between px-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-glass-local" />
          <span className="text-muted-foreground">Local</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-glass-peer" />
          <span className="text-muted-foreground">Peer</span>
        </div>
      </div>
    </div>
  )
}
