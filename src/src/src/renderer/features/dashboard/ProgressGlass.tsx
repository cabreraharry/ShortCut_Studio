import { useMemo, useId } from 'react'

interface ProgressGlassProps {
  localPct: number       // 0-100
  peerPct: number        // 0-100, stacked above local
  totalLabel?: string
  labels?: { local?: string; peer?: string }
}

const BUBBLES = [
  { cx: 60, delay: 0, dur: 5 },
  { cx: 95, delay: 1.4, dur: 6 },
  { cx: 130, delay: 2.8, dur: 5.2 },
  { cx: 75, delay: 4.1, dur: 5.8 },
  { cx: 115, delay: 3.3, dur: 6.3 }
]

export function ProgressGlass({ localPct, peerPct, totalLabel, labels }: ProgressGlassProps) {
  const uid = useId().replace(/:/g, '')
  const clipId = `glass-clip-${uid}`
  const localGradId = `local-grad-${uid}`
  const peerGradId = `peer-grad-${uid}`
  const { localY, localH, peerY, peerH, totalPct, liquidTop } = useMemo(() => {
    const clampedLocal = Math.max(0, Math.min(100, localPct))
    const clampedPeer = Math.max(0, Math.min(100 - clampedLocal, peerPct))
    const total = clampedLocal + clampedPeer

    const innerTop = 30
    const innerBottom = 290
    const innerHeight = innerBottom - innerTop

    const localFillH = (clampedLocal / 100) * innerHeight
    const peerFillH = (clampedPeer / 100) * innerHeight
    const topY = innerBottom - localFillH - peerFillH

    return {
      totalPct: total,
      localY: innerBottom - localFillH,
      localH: localFillH,
      peerY: topY,
      peerH: peerFillH,
      liquidTop: topY
    }
  }, [localPct, peerPct])

  return (
    <div className="relative mx-auto w-[140px] shrink-0">
      {/* Ambient glow behind the glass */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full blur-2xl"
        style={{
          background:
            'radial-gradient(ellipse at 50% 70%, hsl(var(--glass-local) / 0.35) 0%, hsl(var(--glass-peer) / 0.25) 40%, transparent 70%)'
        }}
      />
      <svg
        viewBox="0 0 180 320"
        preserveAspectRatio="xMidYMid meet"
        className="relative block h-auto w-full"
        aria-label="Progress Glass"
      >
        <defs>
          <clipPath id={clipId}>
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
          <linearGradient id={localGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--glass-local))" stopOpacity="0.95" />
            <stop offset="100%" stopColor="hsl(var(--glass-local))" stopOpacity="0.75" />
          </linearGradient>
          <linearGradient id={peerGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--glass-peer))" stopOpacity="0.95" />
            <stop offset="100%" stopColor="hsl(var(--glass-peer))" stopOpacity="0.75" />
          </linearGradient>
        </defs>

        {/* Glass background (empty, subtle) */}
        <g clipPath={`url(#${clipId})`}>
          <rect x="0" y="0" width="180" height="320" className="fill-muted/15" />
        </g>

        {/* Peer liquid (top layer) */}
        <g clipPath={`url(#${clipId})`}>
          <rect
            x="0"
            y={peerY}
            width="180"
            height={peerH}
            fill={`url(#${peerGradId})`}
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
        <g clipPath={`url(#${clipId})`}>
          <rect
            x="0"
            y={localY}
            width="180"
            height={localH}
            fill={`url(#${localGradId})`}
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

        {/* Rising bubbles (only show if there's liquid to bubble through) */}
        {localH + peerH > 40 && (
          <g clipPath={`url(#${clipId})`}>
            {BUBBLES.map((b, i) => (
              <circle
                key={i}
                cx={b.cx}
                cy={285}
                r={2 + (i % 3)}
                fill="white"
                fillOpacity="0.5"
                style={{
                  transformOrigin: `${b.cx}px 285px`,
                  animation: `glassBubble ${b.dur}s ease-in ${b.delay}s infinite`
                }}
              />
            ))}
            {/* Shimmer at the top of the liquid */}
            {liquidTop < 270 && (
              <line
                x1="30"
                y1={liquidTop + 1}
                x2="150"
                y2={liquidTop + 1}
                stroke="white"
                strokeOpacity="0.3"
                strokeWidth="1"
                style={{ transition: 'y1 600ms ease, y2 600ms ease' }}
              />
            )}
          </g>
        )}

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
      <div className="mt-2 flex justify-between gap-2 px-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-glass-local" />
          <span className="text-muted-foreground">{labels?.local ?? 'Local'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-glass-peer" />
          <span className="text-muted-foreground">{labels?.peer ?? 'Peer'}</span>
        </div>
      </div>
    </div>
  )
}
