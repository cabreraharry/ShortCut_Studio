import { Link } from 'react-router-dom'
import { ArrowRight, Info } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { APP_NAME, APP_VERSION, APP_BUILD_DATE } from '@/lib/app-info'
import { HowItWorksSteps } from '@/features/about/HowItWorksSteps'
import content from '@/features/about/content.json'

export interface AboutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps): JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            About {APP_NAME}
          </DialogTitle>
          <DialogDescription>What this is and how to use it.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-lg font-semibold tracking-tight">
              <span className="bg-gradient-to-r from-glass-local via-primary to-glass-peer bg-clip-text text-transparent">
                ShortCut
              </span>{' '}
              Studio
            </span>
            <span className="font-mono text-xs text-muted-foreground">v{APP_VERSION}</span>
            <span className="text-xs text-muted-foreground">built {APP_BUILD_DATE}</span>
          </div>

          <p className="text-sm leading-relaxed text-muted-foreground">
            {content.ourSolution.paragraphs[0]}
          </p>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              How to use it
            </div>
            <HowItWorksSteps
              steps={content.howItWorks.steps}
              variant="compact"
              onNavigate={() => onOpenChange(false)}
            />
          </div>

          <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs">
            <Link
              to="/about"
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Learn more
              <ArrowRight className="h-3 w-3" />
            </Link>
            <span className="text-[10px] text-muted-foreground">
              Windows desktop · Electron, React, Tailwind
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
