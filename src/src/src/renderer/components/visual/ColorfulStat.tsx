import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export type StatTone = 'primary' | 'local' | 'peer' | 'muted' | 'success' | 'warning' | 'danger'

const TONE_CLASSES: Record<StatTone, { grad: string; text: string; icon: string }> = {
  primary: {
    grad: 'from-primary/15 via-primary/5 to-transparent dark:from-primary/25 dark:via-primary/5',
    text: 'text-primary',
    icon: 'bg-primary/20 text-primary'
  },
  local: {
    grad: 'from-glass-local/15 via-glass-local/5 to-transparent dark:from-glass-local/25 dark:via-glass-local/5',
    text: 'text-glass-local',
    icon: 'bg-glass-local/20 text-glass-local'
  },
  peer: {
    grad: 'from-glass-peer/15 via-glass-peer/5 to-transparent dark:from-glass-peer/25 dark:via-glass-peer/5',
    text: 'text-glass-peer',
    icon: 'bg-glass-peer/20 text-glass-peer'
  },
  muted: {
    grad: 'from-muted/40 via-muted/10 to-transparent',
    text: 'text-foreground',
    icon: 'bg-muted/50 text-muted-foreground'
  },
  success: {
    grad: 'from-emerald-500/15 via-emerald-500/5 to-transparent dark:from-emerald-500/25',
    text: 'text-emerald-700 dark:text-emerald-400',
    icon: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
  },
  warning: {
    grad: 'from-amber-500/15 via-amber-500/5 to-transparent dark:from-amber-500/25',
    text: 'text-amber-700 dark:text-amber-400',
    icon: 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
  },
  danger: {
    grad: 'from-rose-500/15 via-rose-500/5 to-transparent dark:from-rose-500/25',
    text: 'text-rose-700 dark:text-rose-400',
    icon: 'bg-rose-500/20 text-rose-700 dark:text-rose-400'
  }
}

export interface ColorfulStatProps {
  label: ReactNode
  value: ReactNode
  sublabel?: ReactNode
  icon?: ReactNode
  tone?: StatTone
  trendPct?: number
  trendLabel?: string
  className?: string
}

export function ColorfulStat({
  label,
  value,
  sublabel,
  icon,
  tone = 'primary',
  trendPct,
  trendLabel,
  className
}: ColorfulStatProps): JSX.Element {
  const t = TONE_CLASSES[tone]
  const hasTrend = typeof trendPct === 'number'
  const trendUp = (trendPct ?? 0) >= 0
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-border/60 bg-gradient-to-br p-4',
        t.grad,
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">{label}</div>
          <div className={cn('mt-1 font-mono text-2xl font-semibold', t.text)}>{value}</div>
          {sublabel && <div className="mt-0.5 text-[11px] text-muted-foreground">{sublabel}</div>}
        </div>
        {icon && (
          <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md', t.icon)}>
            {icon}
          </div>
        )}
      </div>
      {hasTrend && (
        <div
          className={cn(
            'mt-2 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
            trendUp
              ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
              : 'bg-rose-500/20 text-rose-700 dark:text-rose-400'
          )}
        >
          {trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {trendUp ? '+' : ''}
          {trendPct}%{trendLabel ? ` ${trendLabel}` : ''}
        </div>
      )}
    </div>
  )
}
