import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { HowItWorksSteps } from '@/features/about/HowItWorksSteps'
import aboutContent from '@/features/about/content.json'
import content from './content.json'
import {
  Rocket,
  CheckCircle2,
  ListChecks,
  BookOpenCheck,
  LifeBuoy,
  Info,
  FolderPlus,
  Sparkles,
  ToggleRight,
  Save,
  Mail
} from 'lucide-react'

type Status = 'draft' | 'final'

function DraftBadge({ status }: { status: Status }): JSX.Element | null {
  if (status !== 'draft') return null
  return (
    <Badge
      variant="secondary"
      className="ml-2 bg-amber-500/20 text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400"
    >
      Draft — owner to review
    </Badge>
  )
}

export default function GettingStartedPage(): JSX.Element {
  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      <Hero />
      <BeforeYouStartCard />
      <FirstStepsCard />
      <WorkflowsCard />
      <HelpCard />
    </div>
  )
}

// ---------- Hero ----------

function Hero(): JSX.Element {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-glass-local/15 via-background to-glass-peer/15">
      <HeroBackdrop />
      <div className="relative grid items-center gap-6 p-8 md:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-background/60 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-widest text-primary backdrop-blur">
            <Rocket className="h-3 w-3" />
            Getting started
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            Your first{' '}
            <span className="bg-gradient-to-r from-glass-local via-primary to-glass-peer bg-clip-text text-transparent">
              10 minutes
            </span>
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
            {content.tagline.text}
            <DraftBadge status={content.tagline._status as Status} />
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
            <HeroStatChip tone="local" label="Scan folders" />
            <HeroStatChip tone="primary" label="Generate topics" />
            <HeroStatChip tone="peer" label="Review + refine" />
          </div>
        </div>
        <HeroIllustration />
      </div>
    </section>
  )
}

function HeroStatChip({ tone, label }: { tone: 'local' | 'primary' | 'peer'; label: string }): JSX.Element {
  const toneClass =
    tone === 'local'
      ? 'border-glass-local/40 bg-glass-local/10 text-glass-local'
      : tone === 'peer'
        ? 'border-glass-peer/40 bg-glass-peer/10 text-glass-peer'
        : 'border-primary/40 bg-primary/10 text-primary'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium ${toneClass}`}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  )
}

function HeroIllustration(): JSX.Element {
  return (
    <svg
      viewBox="0 0 280 200"
      className="h-auto w-full drop-shadow-[0_8px_24px_rgba(99,102,241,0.15)]"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="gs-paper" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--background))" stopOpacity="0.95" />
          <stop offset="100%" stopColor="hsl(var(--muted))" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="gs-arrow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="hsl(var(--glass-local))" />
          <stop offset="100%" stopColor="hsl(var(--glass-peer))" />
        </linearGradient>
        <radialGradient id="gs-node" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="white" stopOpacity="0.35" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.9" />
        </radialGradient>
      </defs>

      {/* Left: stack of docs */}
      <g transform="translate(18 40)">
        <rect x="8" y="12" width="56" height="72" rx="4" fill="url(#gs-paper)" stroke="hsl(var(--border))" strokeWidth="1" transform="rotate(-4 36 48)" />
        <rect x="12" y="8" width="56" height="72" rx="4" fill="url(#gs-paper)" stroke="hsl(var(--border))" strokeWidth="1" transform="rotate(2 40 44)" />
        <rect x="4" y="4" width="56" height="72" rx="4" fill="url(#gs-paper)" stroke="hsl(var(--border))" strokeWidth="1.5" />
        {/* Text lines on front doc */}
        <line x1="12" y1="18" x2="52" y2="18" stroke="hsl(var(--muted-foreground))" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="12" y1="26" x2="44" y2="26" stroke="hsl(var(--muted-foreground))" strokeOpacity="0.4" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="12" y1="34" x2="48" y2="34" stroke="hsl(var(--muted-foreground))" strokeOpacity="0.4" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="12" y1="42" x2="38" y2="42" stroke="hsl(var(--muted-foreground))" strokeOpacity="0.4" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="12" y1="50" x2="50" y2="50" stroke="hsl(var(--muted-foreground))" strokeOpacity="0.4" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="12" y1="58" x2="42" y2="58" stroke="hsl(var(--muted-foreground))" strokeOpacity="0.4" strokeWidth="1.5" strokeLinecap="round" />
      </g>

      {/* Middle: flowing arrow */}
      <g transform="translate(98 90)">
        <path d="M 0 10 Q 30 0 60 10" stroke="url(#gs-arrow)" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M 54 5 L 62 10 L 54 15" stroke="hsl(var(--glass-peer))" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="15" cy="8" r="1.8" fill="hsl(var(--glass-local))">
          <animate attributeName="cx" values="0;60;0" dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;1;0" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx="30" cy="6" r="1.5" fill="hsl(var(--primary))">
          <animate attributeName="cx" values="0;60;0" dur="3s" begin="1s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;1;0" dur="3s" begin="1s" repeatCount="indefinite" />
        </circle>
      </g>

      {/* Right: topic network */}
      <g transform="translate(160 32)">
        {/* Links */}
        <line x1="55" y1="70" x2="25" y2="25" stroke="hsl(var(--primary))" strokeOpacity="0.35" strokeWidth="1.2" />
        <line x1="55" y1="70" x2="90" y2="28" stroke="hsl(var(--primary))" strokeOpacity="0.35" strokeWidth="1.2" />
        <line x1="55" y1="70" x2="15" y2="85" stroke="hsl(var(--primary))" strokeOpacity="0.35" strokeWidth="1.2" />
        <line x1="55" y1="70" x2="98" y2="92" stroke="hsl(var(--primary))" strokeOpacity="0.35" strokeWidth="1.2" />
        <line x1="55" y1="70" x2="50" y2="128" stroke="hsl(var(--primary))" strokeOpacity="0.35" strokeWidth="1.2" />
        <line x1="25" y1="25" x2="90" y2="28" stroke="hsl(var(--primary))" strokeOpacity="0.2" strokeWidth="1" />
        <line x1="15" y1="85" x2="50" y2="128" stroke="hsl(var(--primary))" strokeOpacity="0.2" strokeWidth="1" />
        <line x1="98" y1="92" x2="50" y2="128" stroke="hsl(var(--primary))" strokeOpacity="0.2" strokeWidth="1" />
        {/* Center big node */}
        <circle cx="55" cy="70" r="14" fill="url(#gs-node)" />
        <text x="55" y="73" textAnchor="middle" className="fill-white" style={{ fontSize: 7, fontWeight: 700 }}>
          TOPIC
        </text>
        {/* Surrounding nodes */}
        <circle cx="25" cy="25" r="6" fill="hsl(var(--glass-local))" fillOpacity="0.9">
          <animate attributeName="r" values="6;7.5;6" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx="90" cy="28" r="5" fill="hsl(var(--glass-peer))" fillOpacity="0.9">
          <animate attributeName="r" values="5;6;5" dur="3.5s" repeatCount="indefinite" />
        </circle>
        <circle cx="15" cy="85" r="5" fill="hsl(var(--glass-peer))" fillOpacity="0.8">
          <animate attributeName="r" values="5;6.5;5" dur="4s" repeatCount="indefinite" />
        </circle>
        <circle cx="98" cy="92" r="6" fill="hsl(var(--glass-local))" fillOpacity="0.85">
          <animate attributeName="r" values="6;7;6" dur="3.2s" repeatCount="indefinite" />
        </circle>
        <circle cx="50" cy="128" r="5" fill="hsl(var(--primary))" fillOpacity="0.85">
          <animate attributeName="r" values="5;6;5" dur="2.8s" repeatCount="indefinite" />
        </circle>
      </g>
    </svg>
  )
}

function HeroBackdrop(): JSX.Element {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full opacity-60"
      viewBox="0 0 800 300"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id="gs-glow-a" cx="20%" cy="25%" r="45%">
          <stop offset="0%" stopColor="hsl(var(--glass-local))" stopOpacity="0.18" />
          <stop offset="100%" stopColor="hsl(var(--glass-local))" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="gs-glow-b" cx="85%" cy="80%" r="40%">
          <stop offset="0%" stopColor="hsl(var(--glass-peer))" stopOpacity="0.18" />
          <stop offset="100%" stopColor="hsl(var(--glass-peer))" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="300" fill="url(#gs-glow-a)" />
      <rect width="800" height="300" fill="url(#gs-glow-b)" />
    </svg>
  )
}

// ---------- Before you start ----------

function BeforeYouStartCard(): JSX.Element {
  const s = content.beforeYouStart
  return (
    <Card className="relative overflow-hidden">
      <CornerGraphic tone="local" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-glass-local/30 to-glass-peer/30 text-primary shadow-sm">
            <CheckCircle2 className="h-4 w-4" />
          </span>
          {s.heading}
          <DraftBadge status={s._status as Status} />
        </CardTitle>
        <CardDescription>A few things to have ready before you dive in.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>{s.body}</p>
        <ul className="space-y-2">
          {s.checklist.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-md border border-border/40 bg-muted/20 px-3 py-2"
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-glass-local/30 to-glass-peer/30 text-primary">
                <CheckCircle2 className="h-3 w-3" />
              </span>
              <span className="text-foreground/80">{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

// ---------- First steps ----------

function FirstStepsCard(): JSX.Element {
  const s = content.firstSteps
  return (
    <Card className="relative overflow-hidden">
      <CornerGraphic tone="primary" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/30 to-glass-peer/30 text-primary shadow-sm">
            <ListChecks className="h-4 w-4" />
          </span>
          {s.heading}
          <DraftBadge status={s._status as Status} />
        </CardTitle>
        <CardDescription>{s.note}</CardDescription>
      </CardHeader>
      <CardContent className="relative">
        {/* Flowing vertical line connecting the steps */}
        <div
          aria-hidden
          className="absolute left-[27px] top-3 bottom-3 w-px bg-gradient-to-b from-glass-local/50 via-primary/30 to-glass-peer/50"
        />
        <div className="relative">
          <HowItWorksSteps steps={aboutContent.howItWorks.steps} variant="spacious" />
        </div>
      </CardContent>
    </Card>
  )
}

// ---------- Workflows ----------

const WORKFLOW_ICONS = [
  { icon: FolderPlus, tone: 'local' as const },
  { icon: Sparkles, tone: 'primary' as const },
  { icon: ToggleRight, tone: 'peer' as const },
  { icon: Save, tone: 'primary' as const }
]

function WorkflowsCard(): JSX.Element {
  const s = content.workflows
  return (
    <Card className="relative overflow-hidden">
      <CornerGraphic tone="peer" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-glass-peer/30 to-primary/30 text-primary shadow-sm">
            <BookOpenCheck className="h-4 w-4" />
          </span>
          {s.heading}
          <DraftBadge status={s._status as Status} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {s.items.map((item, i) => {
            const meta = WORKFLOW_ICONS[i % WORKFLOW_ICONS.length]
            const Icon = meta.icon
            const toneClass =
              meta.tone === 'local'
                ? 'from-glass-local/25 to-glass-local/5 text-glass-local'
                : meta.tone === 'peer'
                  ? 'from-glass-peer/25 to-glass-peer/5 text-glass-peer'
                  : 'from-primary/25 to-primary/5 text-primary'
            return (
              <div
                key={i}
                className="flex gap-3 rounded-lg border border-border/50 bg-card/40 p-3"
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br shadow-sm ${toneClass}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{item.title}</div>
                  <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {item.body}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------- Help ----------

function HelpCard(): JSX.Element {
  const s = content.help
  return (
    <Card className="relative overflow-hidden border-dashed">
      <CornerGraphic tone="local" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-glass-local/30 to-primary/30 text-primary shadow-sm">
            <LifeBuoy className="h-4 w-4" />
          </span>
          {s.heading}
          <DraftBadge status={s._status as Status} />
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
        <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>{s.body}</p>
          <p className="flex items-start gap-2 rounded-md border border-border/40 bg-muted/20 p-2 text-xs">
            <Info className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
            {s.note}
          </p>
          <p className="flex items-start gap-2 text-xs">
            <Mail className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
            <span>Contact channel (email / Discord / GitHub) — owner to supply.</span>
          </p>
        </div>
        <HelpIllustration />
      </CardContent>
    </Card>
  )
}

function HelpIllustration(): JSX.Element {
  return (
    <svg
      viewBox="0 0 140 140"
      className="h-auto w-full"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="gs-help-ring" cx="50%" cy="50%" r="50%">
          <stop offset="55%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          <stop offset="70%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="70" cy="70" r="62" fill="url(#gs-help-ring)" />
      {/* Life preserver */}
      <circle cx="70" cy="70" r="34" fill="none" stroke="hsl(var(--primary))" strokeWidth="10" strokeOpacity="0.85" />
      <circle cx="70" cy="70" r="34" fill="none" stroke="white" strokeWidth="10" strokeDasharray="12 12" strokeOpacity="0.6" />
      <circle cx="70" cy="70" r="20" fill="hsl(var(--background))" />
      <circle cx="70" cy="70" r="20" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeOpacity="0.5" />
      <text x="70" y="77" textAnchor="middle" className="fill-primary" style={{ fontSize: 20, fontWeight: 700 }}>
        ?
      </text>
    </svg>
  )
}

// ---------- Corner graphic (reused across cards) ----------

function CornerGraphic({ tone }: { tone: 'local' | 'primary' | 'peer' }): JSX.Element {
  const color =
    tone === 'local'
      ? 'hsl(var(--glass-local))'
      : tone === 'peer'
        ? 'hsl(var(--glass-peer))'
        : 'hsl(var(--primary))'
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 opacity-30"
      viewBox="0 0 160 160"
    >
      <circle cx="80" cy="80" r="60" stroke={color} strokeWidth="1" fill="none" strokeOpacity="0.5" />
      <circle cx="80" cy="80" r="40" stroke={color} strokeWidth="1" fill="none" strokeOpacity="0.4" />
      <circle cx="80" cy="80" r="20" stroke={color} strokeWidth="1" fill="none" strokeOpacity="0.3" />
      <circle cx="80" cy="80" r="3" fill={color} />
      <circle cx="120" cy="40" r="2" fill={color} opacity="0.6" />
      <circle cx="40" cy="120" r="2" fill={color} opacity="0.6" />
      <circle cx="130" cy="100" r="1.5" fill={color} opacity="0.5" />
    </svg>
  )
}
