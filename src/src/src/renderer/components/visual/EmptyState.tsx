import type { ReactNode } from 'react'

export type EmptyStateVariant = 'folders' | 'topics' | 'review' | 'search' | 'network' | 'generic'

export function EmptyState({
  variant = 'generic',
  title,
  description,
  action
}: {
  variant?: EmptyStateVariant
  title: string
  description: string
  action?: ReactNode
}): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border/60 bg-card/30 p-10 text-center">
      <Illustration variant={variant} />
      <div className="space-y-1">
        <p className="text-base font-semibold">{title}</p>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  )
}

function Illustration({ variant }: { variant: EmptyStateVariant }): JSX.Element {
  switch (variant) {
    case 'folders':
      return <FoldersArt />
    case 'topics':
      return <TopicsArt />
    case 'review':
      return <ReviewArt />
    case 'search':
      return <SearchArt />
    case 'network':
      return <NetworkArt />
    default:
      return <GenericArt />
  }
}

function Wrapper({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 via-glass-local/10 to-glass-peer/10">
      <svg viewBox="0 0 120 120" className="h-24 w-24" aria-hidden="true">
        {children}
      </svg>
    </div>
  )
}

function FoldersArt(): JSX.Element {
  return (
    <Wrapper>
      <g>
        <path
          d="M 20 42 L 50 42 L 58 50 L 98 50 L 98 92 L 20 92 Z"
          fill="hsl(var(--glass-local))"
          fillOpacity="0.35"
          stroke="hsl(var(--glass-local))"
          strokeWidth="1.5"
        />
        <path
          d="M 28 50 L 58 50 L 66 58 L 106 58 L 100 92 L 22 92 Z"
          fill="hsl(var(--glass-peer))"
          fillOpacity="0.55"
          stroke="hsl(var(--glass-peer))"
          strokeWidth="1.5"
        />
        <circle cx="60" cy="30" r="3" fill="hsl(var(--primary))" style={{ animation: 'heroFloat 3s ease-in-out infinite' }} />
        <circle cx="85" cy="38" r="2" fill="hsl(var(--glass-peer))" style={{ animation: 'heroFloat 3s ease-in-out 1s infinite' }} />
      </g>
    </Wrapper>
  )
}

function TopicsArt(): JSX.Element {
  return (
    <Wrapper>
      <g>
        <rect x="22" y="32" width="38" height="14" rx="7" fill="hsl(var(--primary))" fillOpacity="0.35" stroke="hsl(var(--primary))" strokeWidth="1" />
        <rect x="66" y="36" width="30" height="12" rx="6" fill="hsl(var(--glass-peer))" fillOpacity="0.4" stroke="hsl(var(--glass-peer))" strokeWidth="1" />
        <rect x="30" y="52" width="46" height="14" rx="7" fill="hsl(var(--glass-local))" fillOpacity="0.35" stroke="hsl(var(--glass-local))" strokeWidth="1" />
        <rect x="18" y="72" width="28" height="12" rx="6" fill="hsl(var(--glass-peer))" fillOpacity="0.4" stroke="hsl(var(--glass-peer))" strokeWidth="1" />
        <rect x="52" y="72" width="44" height="14" rx="7" fill="hsl(var(--primary))" fillOpacity="0.35" stroke="hsl(var(--primary))" strokeWidth="1" />
      </g>
    </Wrapper>
  )
}

function ReviewArt(): JSX.Element {
  return (
    <Wrapper>
      <g>
        <rect x="24" y="30" width="72" height="60" rx="6" fill="hsl(var(--card))" stroke="hsl(var(--glass-local))" strokeOpacity="0.5" strokeWidth="1.5" />
        <line x1="34" y1="44" x2="86" y2="44" stroke="hsl(var(--muted-foreground))" strokeOpacity="0.4" strokeWidth="1.5" />
        <line x1="34" y1="54" x2="78" y2="54" stroke="hsl(var(--muted-foreground))" strokeOpacity="0.4" strokeWidth="1.5" />
        <line x1="34" y1="64" x2="82" y2="64" stroke="hsl(var(--muted-foreground))" strokeOpacity="0.4" strokeWidth="1.5" />
        <circle cx="86" cy="80" r="10" fill="hsl(var(--glass-peer))" fillOpacity="0.7" />
        <path d="M 81 80 L 85 84 L 91 76" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </Wrapper>
  )
}

function SearchArt(): JSX.Element {
  return (
    <Wrapper>
      <g>
        <circle cx="50" cy="50" r="24" fill="hsl(var(--primary))" fillOpacity="0.15" stroke="hsl(var(--primary))" strokeWidth="2.5" />
        <line x1="68" y1="68" x2="90" y2="90" stroke="hsl(var(--primary))" strokeWidth="4" strokeLinecap="round" />
        <circle cx="45" cy="45" r="4" fill="hsl(var(--glass-peer))" />
      </g>
    </Wrapper>
  )
}

function NetworkArt(): JSX.Element {
  return (
    <Wrapper>
      <g>
        <g stroke="hsl(var(--glass-peer))" strokeOpacity="0.35" strokeWidth="1.2">
          <line x1="60" y1="60" x2="25" y2="30" />
          <line x1="60" y1="60" x2="95" y2="30" />
          <line x1="60" y1="60" x2="25" y2="90" />
          <line x1="60" y1="60" x2="95" y2="90" />
        </g>
        {[
          { cx: 25, cy: 30 },
          { cx: 95, cy: 30 },
          { cx: 25, cy: 90 },
          { cx: 95, cy: 90 }
        ].map((p, i) => (
          <circle
            key={i}
            cx={p.cx}
            cy={p.cy}
            r="5"
            fill="hsl(var(--glass-peer))"
            fillOpacity="0.8"
            style={{ animation: `heroPulse 2.4s ease-in-out ${i * 0.4}s infinite` }}
          />
        ))}
        <circle cx="60" cy="60" r="8" fill="hsl(var(--glass-local))" />
      </g>
    </Wrapper>
  )
}

function GenericArt(): JSX.Element {
  return (
    <Wrapper>
      <circle cx="60" cy="60" r="30" fill="hsl(var(--primary))" fillOpacity="0.2" stroke="hsl(var(--primary))" strokeOpacity="0.5" strokeWidth="2" />
      <circle cx="60" cy="60" r="14" fill="hsl(var(--primary))" fillOpacity="0.6" />
    </Wrapper>
  )
}
