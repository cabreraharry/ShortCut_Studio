import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground',
        success: 'border-transparent bg-emerald-600/20 text-emerald-800 dark:text-emerald-300',
        warning: 'border-transparent bg-amber-600/25 text-amber-900 dark:text-amber-300',
        // Domain-specific variants — local-/peer-network tones map to the
        // glass-* CSS variables already used by ProgressGlass + the dashboard
        // hero. `accent` is the catch-all for "primary tone, not a CTA"
        // (estimated badges, etc). Consolidate open-coded pills here so all
        // badges across the app pick up the same padding + font + radius.
        local: 'border-glass-local/40 bg-glass-local/15 text-glass-local',
        peer: 'border-glass-peer/40 bg-glass-peer/15 text-glass-peer',
        accent: 'border-primary/40 bg-primary/15 text-primary',
        info: 'border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-400'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { badgeVariants }
