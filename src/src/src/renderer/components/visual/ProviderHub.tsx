import { useQuery } from '@tanstack/react-query'
import { Laptop, Cloud } from 'lucide-react'
import { api } from '@/lib/api'
import { isLocalProvider } from '@shared/providers'

interface NodePos {
  name: string
  cx: number
  cy: number
  kind: 'local' | 'cloud'
}

// All six seeded providers get a slot. Local stack sits left of the
// dashed divider, cloud stack to the right. Y values fan out so labels
// never collide. Add a coord here when introducing a new provider —
// missing entries fall back to the off-canvas slot below.
const POSITIONS: Record<string, NodePos> = {
  Ollama: { name: 'Ollama', cx: 70, cy: 80, kind: 'local' },
  'LM Studio': { name: 'LM Studio', cx: 70, cy: 175, kind: 'local' },
  OpenAI: { name: 'OpenAI', cx: 330, cy: 40, kind: 'cloud' },
  Claude: { name: 'Claude', cx: 360, cy: 110, kind: 'cloud' },
  Gemini: { name: 'Gemini', cx: 360, cy: 175, kind: 'cloud' },
  HuggingFace: { name: 'HuggingFace', cx: 330, cy: 230, kind: 'cloud' }
}

// Position for any provider whose name we haven't mapped above. Better than
// silently dropping the node — the user adding a new provider should see
// SOMETHING light up in the hero so the widget reflects their state.
const FALLBACK_POSITION: NodePos = { name: 'Other', cx: 200, cy: 250, kind: 'cloud' }

export function ProviderHub(): JSX.Element {
  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => api.llm.listProviders()
  })

  // Local providers don't need a key — they're "configured" by virtue
  // of being installable. Cloud providers need an API key. Source-of-
  // truth on local-vs-cloud is the shared providers module so adding a
  // new local provider in one place doesn't drift this widget.
  const configuredCount = providers.filter(
    (p) => p.hasApiKey === 'Y' || isLocalProvider(p.providerName)
  ).length

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-glass-local/10 via-transparent to-glass-peer/10 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Provider hub</div>
          <div className="text-xs text-muted-foreground">
            {configuredCount > 0
              ? `${configuredCount} provider${configuredCount === 1 ? '' : 's'} configured · local and cloud routes are separate`
              : 'Start with Ollama (no key needed) or add an API key below'}
          </div>
        </div>
        <div className="flex gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Laptop className="h-3 w-3 text-glass-local" /> Local
          </span>
          <span className="flex items-center gap-1.5">
            <Cloud className="h-3 w-3 text-glass-peer" /> Cloud
          </span>
        </div>
      </div>
      <svg viewBox="0 0 420 260" className="h-52 w-full" aria-hidden="true">
        {/* Divider line between local side and cloud side */}
        <line
          x1="200"
          y1="20"
          x2="200"
          y2="240"
          stroke="hsl(var(--border))"
          strokeDasharray="4 4"
          strokeOpacity="0.5"
        />
        <text
          x="120"
          y="30"
          textAnchor="middle"
          className="fill-glass-local"
          style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1 }}
        >
          ON YOUR MACHINE
        </text>
        <text
          x="310"
          y="30"
          textAnchor="middle"
          className="fill-glass-peer"
          style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1 }}
        >
          CLOUD APIs
        </text>

        {/* Center "YOU" node */}
        {providers.map((p) => {
          const pos = POSITIONS[p.providerName] ?? FALLBACK_POSITION
          // "Active" follows the same rule as ProvidersList: cloud providers
          // need a key, local providers are always active. pos.kind is just
          // a layout hint and would be wrong for a local provider that
          // fell back to FALLBACK_POSITION (cloud-side coords).
          const active = p.hasApiKey === 'Y' || isLocalProvider(p.providerName)
          const color = pos.kind === 'local' ? 'hsl(var(--glass-local))' : 'hsl(var(--glass-peer))'
          return (
            <g key={p.providerName}>
              <line
                x1="200"
                y1="130"
                x2={pos.cx}
                y2={pos.cy}
                stroke={color}
                strokeOpacity={active ? 0.55 : 0.15}
                strokeWidth="1.5"
                strokeDasharray={active ? '4 3' : undefined}
                style={active ? { animation: `peerLinkFlow 2.5s linear infinite` } : undefined}
              />
            </g>
          )
        })}

        <circle cx="200" cy="130" r="22" fill="hsl(var(--primary))" fillOpacity="0.15" />
        <circle cx="200" cy="130" r="16" fill="hsl(var(--primary))" fillOpacity="0.4" />
        <circle cx="200" cy="130" r="10" fill="hsl(var(--primary))" />
        <text
          x="200"
          y="133"
          textAnchor="middle"
          className="fill-white"
          style={{ fontSize: 9, fontWeight: 700 }}
        >
          YOU
        </text>

        {/* Provider nodes */}
        {providers.map((p, i) => {
          const pos = POSITIONS[p.providerName] ?? FALLBACK_POSITION
          // "Active" follows the same rule as ProvidersList: cloud providers
          // need a key, local providers are always active. pos.kind is just
          // a layout hint and would be wrong for a local provider that
          // fell back to FALLBACK_POSITION (cloud-side coords).
          const active = p.hasApiKey === 'Y' || isLocalProvider(p.providerName)
          const color = pos.kind === 'local' ? 'hsl(var(--glass-local))' : 'hsl(var(--glass-peer))'
          return (
            <g key={p.providerName}>
              {active && (
                <circle
                  cx={pos.cx}
                  cy={pos.cy}
                  r="22"
                  fill={color}
                  fillOpacity="0.2"
                  style={{
                    animation: `peerNodePulse 2.4s ease-in-out ${(i * 0.4).toFixed(1)}s infinite`,
                    transformOrigin: `${pos.cx}px ${pos.cy}px`
                  }}
                />
              )}
              <circle
                cx={pos.cx}
                cy={pos.cy}
                r="14"
                fill={color}
                fillOpacity={active ? 0.95 : 0.3}
                stroke={color}
                strokeWidth="1"
              />
              <text
                x={pos.cx}
                y={pos.cy + 3}
                textAnchor="middle"
                className="fill-white"
                style={{ fontSize: 8, fontWeight: 700 }}
              >
                {p.providerName.slice(0, 4).toUpperCase()}
              </text>
              <text
                x={pos.cx}
                y={pos.cy + 32}
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{ fontSize: 9 }}
              >
                {p.providerName}
              </text>
              {active && (
                <text
                  x={pos.cx}
                  y={pos.cy + 44}
                  textAnchor="middle"
                  className="fill-emerald-600 dark:fill-emerald-400"
                  style={{ fontSize: 8, fontWeight: 700 }}
                >
                  ● ready
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
