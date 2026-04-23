import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type HeroTone = 'primary' | 'community' | 'neutral'

export interface HeroProps {
  title: React.ReactNode
  subtitle?: React.ReactNode
  visual?: React.ReactNode
  about?: React.ReactNode
  aboutDefaultOpen?: boolean
  tone?: HeroTone
  className?: string
}

const TONE: Record<HeroTone, { bg: string; accent: string }> = {
  primary: {
    bg: 'from-primary/15 via-glass-local/10 to-transparent',
    accent: 'from-glass-local/30 to-glass-peer/30'
  },
  community: {
    bg: 'from-glass-peer/15 via-primary/10 to-transparent',
    accent: 'from-glass-peer/40 to-primary/30'
  },
  neutral: {
    bg: 'from-muted/60 via-muted/30 to-transparent',
    accent: 'from-muted/40 to-muted/20'
  }
}

export function Hero({
  title,
  subtitle,
  visual,
  about,
  aboutDefaultOpen = false,
  tone = 'primary',
  className
}: HeroProps): JSX.Element {
  const [open, setOpen] = useState(aboutDefaultOpen)
  const toneClass = TONE[tone]
  const hasAbout = about !== undefined && about !== null

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-xl border border-border bg-gradient-to-br',
        toneClass.bg,
        className
      )}
    >
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-gradient-to-br blur-3xl opacity-60',
          toneClass.accent
        )}
      />
      <div className="relative flex flex-col gap-4 p-6 md:flex-row md:items-start md:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h2 className="text-2xl font-semibold leading-tight tracking-tight">{title}</h2>
          {subtitle && (
            <div className="text-sm text-muted-foreground">{subtitle}</div>
          )}
          {hasAbout && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen((v) => !v)}
              className="mt-1 -ml-2 w-fit text-xs text-muted-foreground hover:text-foreground"
            >
              {open ? (
                <>
                  <ChevronUp className="mr-1 h-3 w-3" /> Hide details
                </>
              ) : (
                <>
                  <ChevronDown className="mr-1 h-3 w-3" /> Show details
                </>
              )}
            </Button>
          )}
        </div>
        {visual && <div className="shrink-0">{visual}</div>}
      </div>
      {hasAbout && (
        <div
          className={cn(
            'motion-safe:transition-[max-height,opacity] overflow-hidden',
            open ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
          )}
          style={{ transitionDuration: '300ms' }}
          aria-hidden={!open}
        >
          <div className="border-t border-border/60 px-6 py-4 text-sm">{about}</div>
        </div>
      )}
    </section>
  )
}
