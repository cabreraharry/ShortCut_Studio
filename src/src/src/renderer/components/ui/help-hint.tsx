import { HelpCircle } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'

/**
 * Compact discoverability affordance: a small `?` glyph that surfaces a
 * tooltip on hover/focus. Use next to labels, headings, or stat values that
 * have non-obvious meaning. Wraps Radix Tooltip so all the existing keyboard
 * + accessibility behavior comes along for free.
 *
 * Voice guidelines for `label` content:
 *  - One short sentence on WHAT it is, optionally a second on WHY/HOW.
 *  - Avoid jargon ("LLM" → "AI" in user-facing copy).
 *  - Mention the data source when it's non-obvious or confusing.
 */
export function HelpHint({
  label,
  className,
  size = 'sm'
}: {
  label: React.ReactNode
  className?: string
  size?: 'xs' | 'sm' | 'md'
}): JSX.Element {
  const dim = size === 'xs' ? 'h-3 w-3' : size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5'
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="More info"
          className={cn(
            'inline-flex shrink-0 items-center justify-center text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded',
            className
          )}
        >
          <HelpCircle className={dim} />
        </button>
      </TooltipTrigger>
      <TooltipContent
        className="max-w-xs whitespace-normal text-left leading-snug"
        side="top"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * Wraps an arbitrary trigger element in a tooltip — for cases where the
 * element itself (a label, a number) IS the affordance and you don't want a
 * separate `?` icon. Example: hover the "92%" inside the Glass.
 */
export function WithHint({
  label,
  children,
  side = 'top',
  asChild = true
}: {
  label: React.ReactNode
  children: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  asChild?: boolean
}): JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild={asChild}>{children}</TooltipTrigger>
      <TooltipContent
        className="max-w-xs whitespace-normal text-left leading-snug"
        side={side}
      >
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
