import { useQuery } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import { api } from '@/lib/api'

export function PrivacyShield(): JSX.Element {
  const { data: terms = [] } = useQuery({
    queryKey: ['privacy-terms'],
    queryFn: () => api.privacy.listTerms()
  })

  const total = terms.length
  const systemCount = terms.filter((t) => t.source === 'system').length
  const userCount = terms.filter((t) => t.source === 'user').length

  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/15 via-glass-local/5 to-transparent p-6">
      <div className="flex items-center gap-6">
        <ShieldSvg />
        <div className="flex-1 space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-background/40 px-3 py-0.5 text-[11px] font-medium text-primary">
            <Lock className="h-3 w-3" />
            Privacy routing active
          </div>
          <h2 className="text-xl font-semibold leading-tight">
            <span className="font-mono text-primary">{total}</span> term
            {total === 1 ? '' : 's'} guarding your private files
          </h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            Any file whose path matches a term below is routed to the <b>Private database</b> and never shared
            with peers or commercial LLMs.
          </p>
          <div className="flex gap-4 pt-1 text-xs">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-primary" /> {systemCount} system default{systemCount === 1 ? '' : 's'}
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-glass-peer" /> {userCount} your term{userCount === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ShieldSvg(): JSX.Element {
  return (
    <div className="relative shrink-0">
      <svg viewBox="0 0 140 160" className="h-32 w-28" aria-hidden="true">
        <defs>
          <linearGradient id="shield-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.7" />
            <stop offset="100%" stopColor="hsl(var(--glass-local))" stopOpacity="0.4" />
          </linearGradient>
        </defs>
        {/* Outer glow pulses */}
        {[0, 0.6, 1.2].map((delay, i) => (
          <path
            key={i}
            d="M 70 10 L 120 30 L 120 80 C 120 115 95 140 70 150 C 45 140 20 115 20 80 L 20 30 Z"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeOpacity="0.15"
            strokeWidth="2"
            style={{
              animation: `peerNodePulse 2.4s ease-in-out ${delay}s infinite`,
              transformOrigin: '70px 80px'
            }}
          />
        ))}
        {/* Shield body */}
        <path
          d="M 70 10 L 120 30 L 120 80 C 120 115 95 140 70 150 C 45 140 20 115 20 80 L 20 30 Z"
          fill="url(#shield-grad)"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
        />
        {/* Inner check mark / lock */}
        <g transform="translate(70 80)">
          <rect x="-14" y="-4" width="28" height="22" rx="3" fill="white" fillOpacity="0.95" />
          <path
            d="M -8 -4 L -8 -14 C -8 -19 -4 -23 0 -23 C 4 -23 8 -19 8 -14 L 8 -4"
            fill="none"
            stroke="white"
            strokeOpacity="0.95"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="0" cy="7" r="3" fill="hsl(var(--primary))" />
        </g>
        {/* Floating particles around the shield */}
        {[
          { cx: 30, cy: 20, delay: 0 },
          { cx: 115, cy: 55, delay: 1 },
          { cx: 25, cy: 100, delay: 0.5 },
          { cx: 118, cy: 110, delay: 1.7 }
        ].map((p, i) => (
          <circle
            key={i}
            cx={p.cx}
            cy={p.cy}
            r="3"
            fill="hsl(var(--primary))"
            fillOpacity="0.5"
            style={{ animation: `heroFloat 4s ease-in-out ${p.delay}s infinite` }}
          />
        ))}
      </svg>
    </div>
  )
}
