import { useNavigate } from 'react-router-dom'
import { FolderPlus, Bot, Sparkles, ArrowRight, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'

const STEPS = [
  {
    num: '1',
    icon: FolderPlus,
    title: 'Pick your folders',
    description: 'Add the directories that hold your eBooks, papers, and notes. SCL will scan them in the background.',
    tone: 'local' as const
  },
  {
    num: '2',
    icon: Bot,
    title: 'Connect an LLM',
    description: 'Run Ollama locally or plug in OpenAI, Claude, or Gemini keys. Local is recommended for sensitive work.',
    tone: 'peer' as const
  },
  {
    num: '3',
    icon: Sparkles,
    title: 'Browse your topics',
    description: 'Generated topics land in the Review queue. Approve, rename, merge — every action trains the next pass.',
    tone: 'primary' as const
  }
]

const TONE_CLASSES = {
  local: { bg: 'bg-glass-local/10', border: 'border-glass-local/30', icon: 'bg-glass-local/20 text-glass-local' },
  peer: { bg: 'bg-glass-peer/10', border: 'border-glass-peer/30', icon: 'bg-glass-peer/20 text-glass-peer' },
  primary: { bg: 'bg-primary/10', border: 'border-primary/30', icon: 'bg-primary/20 text-primary' }
}

export function WelcomeHero(): JSX.Element {
  const navigate = useNavigate()

  return (
    <div className="relative -m-6 flex min-h-full flex-col overflow-hidden bg-gradient-to-br from-primary/15 via-glass-local/5 to-glass-peer/10">
      <WelcomeBackdrop />
      <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12">
        <div className="flex-1 space-y-10">
          {/* Brand header */}
          <div className="space-y-4 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-background/60 px-4 py-1.5 text-xs font-medium text-primary backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Welcome to ShortCut Studio
            </div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
              Organize your research{' '}
              <span className="bg-gradient-to-r from-glass-local via-primary to-glass-peer bg-clip-text text-transparent">
                collaboratively.
              </span>
            </h1>
            <p className="mx-auto max-w-2xl text-base text-muted-foreground">
              ShortCut Studio scans your library, classifies with LLMs you control, and shares the busy-work
              with a network of peers. Your documents never leave your machine.
            </p>
          </div>

          {/* 3-step cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {STEPS.map((s) => {
              const t = TONE_CLASSES[s.tone]
              const Icon = s.icon
              return (
                <div
                  key={s.num}
                  className={`relative overflow-hidden rounded-xl border ${t.border} ${t.bg} p-5 backdrop-blur transition-transform hover:-translate-y-1`}
                >
                  <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg ${t.icon}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs font-bold opacity-60">STEP {s.num}</span>
                  </div>
                  <h3 className="mb-1.5 text-lg font-semibold">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.description}</p>
                </div>
              )
            })}
          </div>

          {/* CTA */}
          <div className="flex flex-col items-center gap-3">
            <Button size="lg" onClick={() => navigate('/folders')} className="px-8">
              Get started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Shield className="h-3 w-3" />
              Privacy-first — experts shouldn&apos;t share their expertise with commercial LLMs. Use remote AI only for busy-work.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function WelcomeBackdrop(): JSX.Element {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-60"
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="welcome-glow-a" cx="20%" cy="30%" r="40%">
          <stop offset="0%" stopColor="hsl(var(--glass-local))" stopOpacity="0.25" />
          <stop offset="100%" stopColor="hsl(var(--glass-local))" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="welcome-glow-b" cx="80%" cy="70%" r="45%">
          <stop offset="0%" stopColor="hsl(var(--glass-peer))" stopOpacity="0.25" />
          <stop offset="100%" stopColor="hsl(var(--glass-peer))" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#welcome-glow-a)" />
      <rect width="1200" height="800" fill="url(#welcome-glow-b)" />
      {Array.from({ length: 24 }).map((_, i) => {
        const cx = (i * 53) % 1200
        const cy = ((i * 97) % 800)
        const r = 1 + ((i * 3) % 4)
        const color = i % 3 === 0 ? 'hsl(var(--primary))' : i % 3 === 1 ? 'hsl(var(--glass-local))' : 'hsl(var(--glass-peer))'
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill={color}
            fillOpacity="0.2"
            style={{ animation: `heroFloat 8s ease-in-out ${(i * 0.2).toFixed(1)}s infinite` }}
          />
        )
      })}
    </svg>
  )
}
