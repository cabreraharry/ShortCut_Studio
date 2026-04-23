import { Link } from 'react-router-dom'
import { Info } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { APP_NAME, APP_VERSION, APP_BUILD_DATE } from '@/lib/app-info'

export interface AboutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const HOW_TO_STEPS: Array<{ to: string; title: string; detail: string; tip: string }> = [
  {
    to: '/folders',
    title: 'Pick folders to scan',
    detail: 'Tell ShortCut where your eBooks and research papers live.',
    tip: 'Opens the Folders page'
  },
  {
    to: '/llm',
    title: 'Configure an LLM',
    detail: 'Use Ollama for fully-local inference, or add an OpenAI / Claude / Gemini key.',
    tip: 'Opens the LLMs page'
  },
  {
    to: '/topics',
    title: 'Review topics as they generate',
    detail: 'Approve, rename, or group AI-suggested topics into super-categories.',
    tip: 'Opens the Topics page'
  },
  {
    to: '/dashboard',
    title: 'Monitor progress',
    detail: 'The Progress Glass shows lifetime progress plus the delta from your chosen time range.',
    tip: 'Opens the Dashboard'
  },
  {
    to: '/privacy',
    title: 'Keep sensitive work private',
    detail: 'Add private terms so matching files route to the Private library and never leave your machine.',
    tip: 'Opens the Privacy page'
  }
]

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
            {APP_NAME} is the unified client-side UI for the SCL document-processing ecosystem.
            Point it at your eBook folders, pick an LLM provider, and it generates topic
            classifications locally — optionally sharing duplicate-detection work with a peer
            network so you process each paper only once.
          </p>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              How to use it
            </div>
            <ol className="space-y-1.5">
              {HOW_TO_STEPS.map((step, i) => (
                <li key={step.to} className="flex gap-3 text-sm">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          to={step.to}
                          onClick={() => onOpenChange(false)}
                          className="font-medium text-primary hover:underline"
                        >
                          {step.title}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>{step.tip}</TooltipContent>
                    </Tooltip>
                    <div className="text-xs text-muted-foreground">{step.detail}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="border-t border-border/60 pt-3 text-[10px] text-muted-foreground">
            Windows desktop · Built with Electron, React, and Tailwind
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
