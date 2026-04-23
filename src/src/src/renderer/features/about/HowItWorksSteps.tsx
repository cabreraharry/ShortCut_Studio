import { Link } from 'react-router-dom'

export interface HowItWorksStep {
  to: string
  title: string
  detail: string
}

interface HowItWorksStepsProps {
  steps: HowItWorksStep[]
  onNavigate?: () => void
  variant?: 'compact' | 'spacious'
}

export function HowItWorksSteps({
  steps,
  onNavigate,
  variant = 'spacious'
}: HowItWorksStepsProps): JSX.Element {
  const compact = variant === 'compact'
  return (
    <ol className={compact ? 'space-y-1.5' : 'space-y-3'}>
      {steps.map((step, i) => (
        <li key={step.to} className="flex gap-3 text-sm">
          <span
            className={
              compact
                ? 'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground'
                : 'mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-glass-local/30 to-glass-peer/30 text-xs font-semibold text-foreground'
            }
          >
            {i + 1}
          </span>
          <div className="min-w-0">
            <Link
              to={step.to}
              onClick={onNavigate}
              className="font-medium text-primary hover:underline"
            >
              {step.title}
            </Link>
            <div className="text-xs text-muted-foreground">{step.detail}</div>
          </div>
        </li>
      ))}
    </ol>
  )
}
