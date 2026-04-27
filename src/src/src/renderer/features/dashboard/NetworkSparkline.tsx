import type { GrowthPoint } from '@shared/types'

interface NetworkSparklineProps {
  points: GrowthPoint[]
  width?: number
  height?: number
}

/**
 * Tiny SVG sparkline of total-row growth across local Consumer Peer DBs.
 * No labels, no axis — meant to live inside the Network card as a glance-
 * level indicator. Color matches the primary gradient.
 */
export function NetworkSparkline({
  points,
  width = 180,
  height = 48
}: NetworkSparklineProps): JSX.Element {
  if (points.length < 2) {
    return (
      <svg width={width} height={height} aria-hidden>
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="hsl(var(--muted-foreground) / 0.4)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      </svg>
    )
  }

  const values = points.map((p) => p.totalRows)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(1, max - min)

  const stepX = width / (points.length - 1)
  const padTop = 4
  const padBottom = 4
  const usableH = height - padTop - padBottom

  const path = points
    .map((p, i) => {
      const x = i * stepX
      const y = padTop + usableH - ((p.totalRows - min) / range) * usableH
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')

  // Fill path: same line, then close at bottom for a soft area fill.
  const fillPath = `${path} L ${(points.length - 1) * stepX} ${height} L 0 ${height} Z`

  // Last-point dot
  const lastX = (points.length - 1) * stepX
  const lastY =
    padTop + usableH - ((points[points.length - 1].totalRows - min) / range) * usableH

  return (
    <svg width={width} height={height} aria-hidden viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="spark-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="hsl(var(--glass-local))" />
          <stop offset="100%" stopColor="hsl(var(--glass-peer))" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill="url(#spark-fill)" />
      <path
        d={path}
        fill="none"
        stroke="url(#spark-line)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r={2.5} fill="hsl(var(--primary))" />
    </svg>
  )
}
