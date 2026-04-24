import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Sparkles, FolderPlus, Bot, ListChecks, Lightbulb, Keyboard } from 'lucide-react'
import { api } from '@/lib/api'
import aboutContent from '@/features/about/content.json'
import { cn } from '@/lib/utils'

const AUTO_DISMISS_MS = 10_000
const FADE_OUT_MS = 280
const HINT_DELAY_MS = 3_000

const STEPS = [
  {
    icon: FolderPlus,
    label: 'Pick your folders',
    blurb: 'PDFs, papers, eBooks — wherever they live.'
  },
  {
    icon: Bot,
    label: 'Connect an LLM',
    blurb: 'Local Ollama or an API key you control.'
  },
  {
    icon: ListChecks,
    label: 'Discover topics',
    blurb: 'Let AI surface what your library is about.'
  }
]

const PRO_TIPS = [
  {
    title: 'Pro tip',
    body: 'Press',
    kbd: 'Ctrl+Shift+D',
    after: 'any time to open the developer overlay — SQL console, IPC inspector, and live worker controls.'
  },
  {
    title: 'Did you know?',
    body: 'Everything stays on this machine. Files, keys, and the SQLite database — nothing uploads unless you explicitly send a file to an LLM provider.',
    kbd: '',
    after: ''
  },
  {
    title: 'Power move',
    body: 'Ollama runs entirely local. Install it, pick a model, and your most sensitive research never touches a commercial API.',
    kbd: '',
    after: ''
  },
  {
    title: 'Keyboard shortcut',
    body: 'Hit',
    kbd: 'Esc',
    after: 'to skip this screen immediately. Or wait it out — your call.'
  }
]

// Pick one tip per app launch so the splash feels fresh across sessions.
const SELECTED_TIP = PRO_TIPS[Math.floor(Math.random() * PRO_TIPS.length)]

/**
 * Full-screen launch splash. Shows once per session on app startup (unless
 * welcomeOnStartup is off). Dismisses on click, Escape, or after ~2.6s.
 * Suppressed on /setup where the wizard already owns the screen.
 */
export function WelcomeOnLaunchDialog(): JSX.Element | null {
  const location = useLocation()
  const qc = useQueryClient()
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.settings.get(),
    staleTime: 30_000
  })
  const [dismissed, setDismissed] = useState(false)
  const [fadingOut, setFadingOut] = useState(false)
  const [hintVisible, setHintVisible] = useState(false)

  const updateSetting = useMutation({
    mutationFn: (next: boolean) =>
      api.settings.update({ welcomeOnStartup: next }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] })
  })

  const shouldRender =
    !!settings?.welcomeOnStartup &&
    !dismissed &&
    location.pathname !== '/setup'

  // Auto-dismiss timer + keyboard handler. Only runs while the splash is
  // actually mounted and active.
  useEffect(() => {
    if (!shouldRender) return
    const dismissTimer = setTimeout(() => startFadeOut(), AUTO_DISMISS_MS)
    const hintTimer = setTimeout(() => setHintVisible(true), HINT_DELAY_MS)
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        startFadeOut()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(dismissTimer)
      clearTimeout(hintTimer)
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldRender])

  function startFadeOut(): void {
    setFadingOut(true)
    setTimeout(() => setDismissed(true), FADE_OUT_MS)
  }

  function handleDontShow(e: React.MouseEvent): void {
    e.stopPropagation()
    updateSetting.mutate(false)
    startFadeOut()
  }

  if (!shouldRender) return null

  return (
    <div
      onClick={startFadeOut}
      role="presentation"
      className={cn(
        'fixed inset-0 z-[100] flex cursor-pointer items-center justify-center overflow-hidden transition-opacity',
        fadingOut ? 'opacity-0 duration-300' : 'opacity-100 duration-300'
      )}
    >
      <SplashBackdrop />

      {/* Don't-show link — top-right corner, doesn't trigger backdrop dismiss */}
      <button
        type="button"
        onClick={handleDontShow}
        className="absolute right-4 top-4 rounded-md px-2 py-1 text-[11px] text-muted-foreground/80 transition-colors hover:bg-background/40 hover:text-foreground"
      >
        Don't show on startup
      </button>

      <div className="relative flex max-w-3xl flex-col items-center px-6 text-center">
        <div className="animate-[splashFloat_3s_ease-in-out_infinite]">
          <SplashGlyph />
        </div>
        <h1 className="mt-5 text-4xl font-bold tracking-tight opacity-0 animate-in fade-in duration-500 [animation-delay:150ms] [animation-fill-mode:forwards] md:text-5xl">
          <span className="bg-gradient-to-r from-glass-local via-primary to-glass-peer bg-clip-text text-transparent">
            ShortCut
          </span>{' '}
          <span className="text-foreground">Studio</span>
        </h1>
        <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-primary opacity-0 animate-in fade-in duration-500 [animation-delay:350ms] [animation-fill-mode:forwards]">
          <Sparkles className="h-3 w-3" />
          Welcome back
        </div>

        <h2 className="mt-6 text-2xl font-semibold tracking-tight opacity-0 animate-in fade-in duration-500 [animation-delay:500ms] [animation-fill-mode:forwards] md:text-3xl">
          Your library, searchable by{' '}
          <span className="bg-gradient-to-r from-glass-local via-primary to-glass-peer bg-clip-text text-transparent">
            idea
          </span>
          .
        </h2>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground opacity-0 animate-in fade-in duration-500 [animation-delay:650ms] [animation-fill-mode:forwards] md:text-base">
          {aboutContent.tagline.text}
        </p>

        <div className="mt-7 opacity-0 animate-in fade-in duration-500 [animation-delay:800ms] [animation-fill-mode:forwards]">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Three moves to get started
          </div>
          <div className="mt-1 text-xs text-muted-foreground/80">
            No wizard required — each page walks you through it.
          </div>
        </div>

        <div className="mt-4 grid w-full gap-3 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <StepCard
              key={i}
              index={i + 1}
              icon={s.icon}
              label={s.label}
              blurb={s.blurb}
              delay={1000 + i * 180}
            />
          ))}
        </div>

        <ProTipCallout delay={1800} />

        <div
          className={cn(
            'mt-8 text-[11px] text-muted-foreground/70 transition-opacity duration-300',
            hintVisible ? 'opacity-100' : 'opacity-0'
          )}
        >
          Click anywhere to continue
        </div>
      </div>

      <style>{`
        @keyframes splashFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes splashCard {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

interface StepCardProps {
  index: number
  icon: React.ComponentType<{ className?: string }>
  label: string
  blurb: string
  delay: number
}

function StepCard({ index, icon: Icon, label, blurb, delay }: StepCardProps): JSX.Element {
  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-border/50 bg-background/40 p-4 text-left opacity-0 backdrop-blur-sm"
      style={{
        animation: `splashCard 500ms ease-out ${delay}ms forwards`
      }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-glass-local/30 to-glass-peer/30 text-primary shadow-sm">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Step {index}
        </span>
      </div>
      <div className="text-sm font-semibold">{label}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{blurb}</div>
    </div>
  )
}

function ProTipCallout({ delay }: { delay: number }): JSX.Element {
  const tip = SELECTED_TIP
  return (
    <div
      className="mt-6 flex w-full max-w-xl items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3 text-left opacity-0 backdrop-blur-sm"
      style={{
        animation: `splashCard 500ms ease-out ${delay}ms forwards`
      }}
    >
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
        <Lightbulb className="h-3 w-3" />
      </span>
      <div className="min-w-0 flex-1 text-xs">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-primary">
          {tip.title}
        </div>
        <div className="mt-0.5 leading-relaxed text-muted-foreground">
          {tip.body}
          {tip.kbd && (
            <>
              {' '}
              <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/70 px-1.5 py-0.5 align-middle font-mono text-[10px] text-foreground">
                <Keyboard className="h-2.5 w-2.5" />
                {tip.kbd}
              </span>{' '}
              {tip.after}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function SplashGlyph(): JSX.Element {
  return (
    <svg
      viewBox="0 0 80 96"
      className="h-24 w-20 drop-shadow-[0_8px_32px_rgba(99,102,241,0.25)] animate-in fade-in zoom-in-90 duration-500"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="splash-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--glass-peer))" />
          <stop offset="100%" stopColor="hsl(var(--glass-local))" />
        </linearGradient>
        <radialGradient id="splash-shine" cx="30%" cy="25%" r="55%">
          <stop offset="0%" stopColor="white" stopOpacity="0.35" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path
        d="M 20 8 L 60 8 L 60 16 L 68 24 L 68 76 A 12 12 0 0 1 56 88 L 24 88 A 12 12 0 0 1 12 76 L 12 24 L 20 16 Z"
        fill="url(#splash-body)"
        fillOpacity="0.92"
      />
      <path
        d="M 20 8 L 60 8 L 60 16 L 68 24 L 68 76 A 12 12 0 0 1 56 88 L 24 88 A 12 12 0 0 1 12 76 L 12 24 L 20 16 Z"
        fill="url(#splash-shine)"
      />
      <rect
        x="20"
        y="52"
        width="40"
        height="32"
        fill="hsl(var(--glass-local))"
        fillOpacity="0.95"
      />
      <circle cx="40" cy="68" r="5" fill="white" fillOpacity="0.95" />
    </svg>
  )
}

function SplashBackdrop(): JSX.Element {
  return (
    <>
      <div className="absolute inset-0 bg-background/85 backdrop-blur-xl" />
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 1600 1000"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="splash-glow-a" cx="25%" cy="20%" r="40%">
            <stop offset="0%" stopColor="hsl(var(--glass-local))" stopOpacity="0.35" />
            <stop offset="100%" stopColor="hsl(var(--glass-local))" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="splash-glow-b" cx="75%" cy="80%" r="45%">
            <stop offset="0%" stopColor="hsl(var(--glass-peer))" stopOpacity="0.35" />
            <stop offset="100%" stopColor="hsl(var(--glass-peer))" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="splash-glow-c" cx="50%" cy="50%" r="35%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="1600" height="1000" fill="url(#splash-glow-a)" />
        <rect width="1600" height="1000" fill="url(#splash-glow-b)" />
        <rect width="1600" height="1000" fill="url(#splash-glow-c)" />
        {Array.from({ length: 18 }).map((_, i) => {
          const cx = (i * 197) % 1600
          const cy = (i * 113) % 1000
          const r = 1.5 + ((i * 2) % 4)
          const color =
            i % 3 === 0
              ? 'hsl(var(--primary))'
              : i % 3 === 1
                ? 'hsl(var(--glass-local))'
                : 'hsl(var(--glass-peer))'
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill={color}
              fillOpacity="0.35"
              style={{
                animation: `splashTwinkle ${3 + (i % 4)}s ease-in-out ${i * 0.18}s infinite`
              }}
            />
          )
        })}
      </svg>
      <style>{`
        @keyframes splashTwinkle {
          0%, 100% { opacity: 0.25; transform: scale(0.8); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
      `}</style>
    </>
  )
}
