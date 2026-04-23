export function AllocationDisc({
  current,
  max,
  label = 'Allocated'
}: {
  current: number
  max: number
  label?: string
}): JSX.Element {
  const clamped = Math.max(0, Math.min(max, current))
  const pct = max > 0 ? clamped / max : 0
  const size = 140
  const stroke = 14
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - pct)

  return (
    <div className="relative flex h-[140px] w-[140px] items-center justify-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id="alloc-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--glass-local))" />
            <stop offset="100%" stopColor="hsl(var(--glass-peer))" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeOpacity="0.3"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#alloc-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 600ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-mono text-2xl font-bold">{clamped}</div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">GB</div>
        <div className="mt-0.5 text-[10px] text-muted-foreground">{label}</div>
      </div>
    </div>
  )
}
