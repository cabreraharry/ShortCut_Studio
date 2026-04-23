import type { SuperCategory, Topic } from '@shared/types'
import { Atom } from 'lucide-react'

interface SuperCategoryAtomsProps {
  supers: SuperCategory[]
  topics: Topic[]
}

export function SuperCategoryAtoms({ supers, topics }: SuperCategoryAtomsProps): JSX.Element {
  if (supers.length === 0) return <></>

  return (
    <div className="rounded-xl border border-border bg-gradient-to-br from-primary/5 via-transparent to-glass-peer/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Atom className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Super-category orbits</span>
        <span className="text-xs text-muted-foreground">
          · Each nucleus is a super-category; orbiting chips are assigned topics.
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {supers.map((sc, i) => (
          <AtomCard
            key={sc.superCategoryId}
            superCategory={sc}
            topics={topics.filter((t) => t.superCategoryId === sc.superCategoryId)}
            colorIndex={i}
          />
        ))}
      </div>
    </div>
  )
}

const COLORS = [
  { name: 'primary', stroke: 'hsl(var(--primary))', fill: 'hsl(var(--primary))' },
  { name: 'local', stroke: 'hsl(var(--glass-local))', fill: 'hsl(var(--glass-local))' },
  { name: 'peer', stroke: 'hsl(var(--glass-peer))', fill: 'hsl(var(--glass-peer))' }
]

function AtomCard({
  superCategory,
  topics,
  colorIndex
}: {
  superCategory: SuperCategory
  topics: Topic[]
  colorIndex: number
}): JSX.Element {
  const color = COLORS[colorIndex % COLORS.length]
  const maxOrbit = 8
  const visible = topics.slice(0, maxOrbit)
  const extra = topics.length - visible.length

  const size = 220
  const cx = size / 2
  const cy = size / 2
  const rOrbit = 70
  const totalSlots = Math.max(visible.length, 1)

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card/60 p-3">
      <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto block h-48 w-48" aria-hidden="true">
        {/* Orbit ring */}
        <circle
          cx={cx}
          cy={cy}
          r={rOrbit}
          fill="none"
          stroke={color.stroke}
          strokeOpacity="0.25"
          strokeWidth="1"
          strokeDasharray="3 4"
        />
        {/* Outer glow on the nucleus */}
        <circle
          cx={cx}
          cy={cy}
          r="30"
          fill={color.fill}
          fillOpacity="0.18"
          style={{
            animation: 'peerNodePulse 2.6s ease-in-out infinite',
            transformOrigin: `${cx}px ${cy}px`
          }}
        />
        {/* Nucleus */}
        <circle cx={cx} cy={cy} r="22" fill={color.fill} fillOpacity="0.95" />

        {/* Rotating orbit group */}
        <g
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            animation: `atomOrbit ${30 + colorIndex * 4}s linear infinite`
          }}
        >
          {visible.map((t, i) => {
            const angle = (i / totalSlots) * Math.PI * 2
            const x = cx + Math.cos(angle) * rOrbit
            const y = cy + Math.sin(angle) * rOrbit
            return (
              <g key={t.topicId}>
                <circle cx={x} cy={y} r="7" fill={color.fill} fillOpacity="0.85" />
                {/* Counter-rotate the label so it stays upright */}
                <g
                  style={{
                    transformOrigin: `${x}px ${y}px`,
                    animation: `atomOrbit ${30 + colorIndex * 4}s linear infinite reverse`
                  }}
                >
                  <text
                    x={x}
                    y={y - 12}
                    textAnchor="middle"
                    className="fill-foreground"
                    style={{ fontSize: 8 }}
                  >
                    {t.topicName.length > 14 ? `${t.topicName.slice(0, 12)}…` : t.topicName}
                  </text>
                </g>
              </g>
            )
          })}
        </g>
      </svg>

      <div className="mt-1 space-y-0.5 text-center">
        <div className="truncate text-sm font-semibold">{superCategory.name}</div>
        <div className="text-[10px] text-muted-foreground">
          {topics.length} topic{topics.length === 1 ? '' : 's'}
          {extra > 0 ? ` (showing ${maxOrbit})` : ''}
        </div>
      </div>
    </div>
  )
}
