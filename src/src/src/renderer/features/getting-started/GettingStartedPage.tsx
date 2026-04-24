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
  Info
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
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      <Hero />
      <BeforeYouStartCard />
      <FirstStepsCard />
      <WorkflowsCard />
      <HelpCard />
    </div>
  )
}

function Hero(): JSX.Element {
  return (
    <section className="rounded-xl border border-border/60 bg-gradient-to-br from-glass-local/10 via-background to-glass-peer/10 p-6">
      <div className="flex items-center gap-2 text-[11px] font-medium text-primary">
        <Rocket className="h-3 w-3" />
        GETTING STARTED
      </div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        Your first 10 minutes
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {content.tagline.text}
        <DraftBadge status={content.tagline._status as Status} />
      </p>
    </section>
  )
}

function BeforeYouStartCard(): JSX.Element {
  const s = content.beforeYouStart
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {s.heading}
          <DraftBadge status={s._status as Status} />
        </CardTitle>
        <CardDescription>A few things to have ready before you dive in.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <p>{s.body}</p>
        <ul className="space-y-1.5">
          {s.checklist.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function FirstStepsCard(): JSX.Element {
  const s = content.firstSteps
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="h-4 w-4" />
          {s.heading}
          <DraftBadge status={s._status as Status} />
        </CardTitle>
        <CardDescription>{s.note}</CardDescription>
      </CardHeader>
      <CardContent>
        <HowItWorksSteps steps={aboutContent.howItWorks.steps} variant="spacious" />
      </CardContent>
    </Card>
  )
}

function WorkflowsCard(): JSX.Element {
  const s = content.workflows
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpenCheck className="h-4 w-4" />
          {s.heading}
          <DraftBadge status={s._status as Status} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-3 text-sm">
          {s.items.map((item, i) => (
            <div key={i}>
              <dt className="font-medium">{item.title}</dt>
              <dd className="mt-0.5 text-muted-foreground">{item.body}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}

function HelpCard(): JSX.Element {
  const s = content.help
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LifeBuoy className="h-4 w-4" />
          {s.heading}
          <DraftBadge status={s._status as Status} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm leading-relaxed text-muted-foreground">
        <p>{s.body}</p>
        <p className="flex items-start gap-2 text-xs">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          {s.note}
        </p>
      </CardContent>
    </Card>
  )
}
