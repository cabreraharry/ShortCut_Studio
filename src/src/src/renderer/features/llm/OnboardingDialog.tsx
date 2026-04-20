import { ExternalLink } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import type { ProviderGuide } from './provider-onboarding'

interface OnboardingDialogProps {
  guide: ProviderGuide | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OnboardingDialog({ guide, open, onOpenChange }: OnboardingDialogProps) {
  if (!guide) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>How to get a {guide.providerName} API key</DialogTitle>
          <DialogDescription>{guide.intro}</DialogDescription>
        </DialogHeader>

        <ol className="space-y-4">
          {guide.steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <div className="flex-1">
                <div className="text-sm font-semibold">{step.title}</div>
                <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
                {step.link && (
                  <Button
                    variant="link"
                    className="mt-1 h-auto p-0 text-xs"
                    onClick={() => api.app.openExternal(step.link!.url)}
                  >
                    {step.link.label} <ExternalLink className="ml-1 h-3 w-3" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ol>

        {guide.keyFormat && (
          <div className="mt-2 rounded-md border border-border bg-muted/30 p-3 text-xs">
            <span className="font-semibold">Key format:</span>{' '}
            <span className="font-mono text-muted-foreground">{guide.keyFormat}</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
