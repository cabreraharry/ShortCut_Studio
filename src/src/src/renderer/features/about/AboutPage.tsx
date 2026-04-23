import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { APP_NAME, APP_VERSION, APP_BUILD_DATE } from '@/lib/app-info'
import { HowItWorksSteps } from './HowItWorksSteps'
import content from './content.json'
import {
  Sparkles,
  Target,
  Compass,
  ShieldAlert,
  Users,
  Heart,
  ListChecks,
  Info
} from 'lucide-react'
import { cn } from '@/lib/utils'

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

export default function AboutPage(): JSX.Element {
  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      <HeroStrip />
      <OurSolutionCard />
      <div className="grid gap-4 md:grid-cols-2">
        <MissionCard />
        <VisionCard />
      </div>
      <HowItWorksCard />
      <PrivacyCard />
      <CommunityCard />
      <CreditsCard />
      <FooterStrip />
    </div>
  )
}

function HeroStrip(): JSX.Element {
  return (
    <section className="rounded-xl border border-border/60 bg-gradient-to-br from-glass-local/10 via-background to-glass-peer/10 p-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          <span className="bg-gradient-to-r from-glass-local via-primary to-glass-peer bg-clip-text text-transparent">
            ShortCut
          </span>{' '}
          Studio
        </h1>
        <span className="font-mono text-xs text-muted-foreground">v{APP_VERSION}</span>
        <span className="text-xs text-muted-foreground">built {APP_BUILD_DATE}</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {content.tagline.text}
        <DraftBadge status={content.tagline._status as Status} />
      </p>
    </section>
  )
}

function OurSolutionCard(): JSX.Element {
  const s = content.ourSolution
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Our solution
          <DraftBadge status={s._status as Status} />
        </CardTitle>
        <CardDescription>What {APP_NAME} actually does for you.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        {s.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </CardContent>
    </Card>
  )
}

function MissionCard(): JSX.Element {
  const s = content.mission
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-4 w-4" />
          Mission
          <DraftBadge status={s._status as Status} />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-2 text-sm leading-relaxed">
        <div className="font-medium">{s.heading}</div>
        <p className="text-muted-foreground">{s.body}</p>
      </CardContent>
    </Card>
  )
}

function VisionCard(): JSX.Element {
  const s = content.vision
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Compass className="h-4 w-4" />
          Vision
          <DraftBadge status={s._status as Status} />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-2 text-sm leading-relaxed">
        <div className="font-medium">{s.heading}</div>
        <p className="text-muted-foreground">{s.body}</p>
      </CardContent>
    </Card>
  )
}

function HowItWorksCard(): JSX.Element {
  const s = content.howItWorks
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="h-4 w-4" />
          How it works
          <DraftBadge status={s._status as Status} />
        </CardTitle>
        <CardDescription>Five steps from empty library to organised topics.</CardDescription>
      </CardHeader>
      <CardContent>
        <HowItWorksSteps steps={s.steps} variant="spacious" />
      </CardContent>
    </Card>
  )
}

function PrivacyCard(): JSX.Element {
  const s = content.privacy
  return (
    <Card className="border-amber-500/50 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          Privacy & data
          <DraftBadge status={s._status as Status} />
        </CardTitle>
        <CardDescription>{s.headline}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <p>{s.body}</p>
        <ul className="space-y-1.5">
          {s.facts.map((fact, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500/70" />
              <span>{fact}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function CommunityCard(): JSX.Element {
  const s = content.community
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Community model
          <DraftBadge status={s._status as Status} />
        </CardTitle>
        <CardDescription>Give-and-take for shared document intelligence.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        {s.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <div
          className={cn(
            'rounded-md border border-border/60 bg-muted/30 p-3 text-xs italic'
          )}
        >
          {s.statusNote}
        </div>
      </CardContent>
    </Card>
  )
}

function CreditsCard(): JSX.Element {
  const s = content.credits
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="h-4 w-4" />
          Credits & tech
          <DraftBadge status={s._status as Status} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        {s.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <div className="flex flex-wrap gap-1.5">
          {s.stack.map((label) => (
            <Badge key={label} variant="secondary" className="text-[10px]">
              {label}
            </Badge>
          ))}
        </div>
        <p className="text-xs italic">{s.acknowledgment}</p>
      </CardContent>
    </Card>
  )
}

function FooterStrip(): JSX.Element {
  const s = content.feedback
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <Info className="h-3 w-3" />
        <span>{s.note}</span>
        <DraftBadge status={s._status as Status} />
      </div>
      <div className="font-mono">
        {APP_NAME} · v{APP_VERSION} · built {APP_BUILD_DATE}
      </div>
    </section>
  )
}
