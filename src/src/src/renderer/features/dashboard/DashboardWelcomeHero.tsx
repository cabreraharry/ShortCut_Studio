import { useNavigate } from 'react-router-dom'
import { BookOpen, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react'
import { APP_NAME } from '@/lib/app-info'
import content from '@/features/about/content.json'

export function DashboardWelcomeHero(): JSX.Element {
  const navigate = useNavigate()

  return (
    <section className="relative overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-glass-local/10 via-background to-glass-peer/10 p-6">
      <WelcomeBackdrop />
      <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        {/* Left: greeting + tagline */}
        <div className="max-w-xl space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-background/60 px-3 py-0.5 text-[11px] font-medium text-primary backdrop-blur">
            <Sparkles className="h-3 w-3" />
            Welcome back
          </div>
          <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
            Make the most of{' '}
            <span className="bg-gradient-to-r from-glass-local via-primary to-glass-peer bg-clip-text text-transparent">
              {APP_NAME}
            </span>
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {content.tagline.text} Two things worth reading while your scans run:
          </p>
        </div>

        {/* Right: two creative tile links */}
        <div className="grid gap-3 sm:grid-cols-2 md:min-w-[380px]">
          <LinkTile
            tone="story"
            icon={<BookOpen className="h-4 w-4" />}
            overline="Get to know us"
            title="Our story"
            blurb="Mission, vision, how it works."
            onClick={() => navigate('/about')}
          />
          <LinkTile
            tone="privacy"
            icon={<ShieldCheck className="h-4 w-4" />}
            overline="What stays on this machine"
            title="Your privacy"
            blurb="Files, keys, and peer shares."
            onClick={() => navigate('/privacy')}
          />
        </div>
      </div>
    </section>
  )
}

interface LinkTileProps {
  tone: 'story' | 'privacy'
  icon: JSX.Element
  overline: string
  title: string
  blurb: string
  onClick: () => void
}

function LinkTile({ tone, icon, overline, title, blurb, onClick }: LinkTileProps): JSX.Element {
  const toneBg =
    tone === 'story'
      ? 'from-glass-local/25 via-primary/10 to-glass-peer/15 hover:from-glass-local/35 hover:to-glass-peer/25'
      : 'from-amber-500/20 via-amber-500/5 to-amber-300/15 hover:from-amber-500/30 hover:to-amber-300/25'
  const iconBg =
    tone === 'story'
      ? 'bg-gradient-to-br from-glass-local/30 to-glass-peer/30 text-primary'
      : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
  const ringTone =
    tone === 'story' ? 'ring-primary/30 group-hover:ring-primary/60' : 'ring-amber-500/30 group-hover:ring-amber-500/60'

  // The previous version put the click affordance on hover only — a small
  // ArrowRight that animated from opacity-60 to 100 — so the tile didn't
  // read as clickable until the user happened to mouse over it. Now the
  // tile shows a persistent "Read →" footer and a `cursor-pointer` so the
  // user knows it's a target before they hover.
  const ctaLabel = tone === 'story' ? 'Read our story' : 'Read privacy notes'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex cursor-pointer items-start gap-3 overflow-hidden rounded-xl bg-gradient-to-br p-4 text-left ring-1 transition-all hover:-translate-y-0.5 hover:shadow-md ${toneBg} ${ringTone}`}
    >
      <TileDecoration tone={tone} />
      <span
        className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm ${iconBg}`}
      >
        {icon}
      </span>
      <div className="relative min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {overline}
        </div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">{blurb}</div>
        <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
          {ctaLabel}
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </button>
  )
}

function TileDecoration({ tone }: { tone: 'story' | 'privacy' }): JSX.Element {
  if (tone === 'story') {
    return (
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute -right-2 -top-2 h-16 w-16 opacity-30 transition-opacity group-hover:opacity-50"
        viewBox="0 0 64 64"
        fill="none"
      >
        <circle cx="44" cy="20" r="14" stroke="hsl(var(--glass-peer))" strokeWidth="1.5" />
        <circle cx="50" cy="30" r="8" stroke="hsl(var(--glass-local))" strokeWidth="1.5" />
        <circle cx="44" cy="20" r="2" fill="hsl(var(--primary))" />
      </svg>
    )
  }
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute -right-3 -top-3 h-16 w-16 opacity-30 transition-opacity group-hover:opacity-50"
      viewBox="0 0 64 64"
      fill="none"
    >
      <path
        d="M 32 6 L 52 16 L 52 30 C 52 42 42 52 32 58 C 22 52 12 42 12 30 L 12 16 Z"
        stroke="hsl(var(--amber-500, 38 92% 50%))"
        strokeWidth="1.5"
      />
      <path d="M 24 30 L 30 36 L 42 22" stroke="rgb(245 158 11)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function WelcomeBackdrop(): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-50"
      viewBox="0 0 600 200"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id="welcome-strip-glow-a" cx="15%" cy="30%" r="35%">
          <stop offset="0%" stopColor="hsl(var(--glass-local))" stopOpacity="0.18" />
          <stop offset="100%" stopColor="hsl(var(--glass-local))" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="welcome-strip-glow-b" cx="85%" cy="70%" r="40%">
          <stop offset="0%" stopColor="hsl(var(--glass-peer))" stopOpacity="0.18" />
          <stop offset="100%" stopColor="hsl(var(--glass-peer))" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="600" height="200" fill="url(#welcome-strip-glow-a)" />
      <rect width="600" height="200" fill="url(#welcome-strip-glow-b)" />
    </svg>
  )
}
