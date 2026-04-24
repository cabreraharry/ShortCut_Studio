import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Sparkles, FolderPlus, Bot, ListChecks, ArrowRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { APP_NAME } from '@/lib/app-info'

const STEPS = [
  {
    icon: FolderPlus,
    title: 'Pick your folders',
    blurb: 'Point us at the PDFs and papers you already have.',
    tone: 'from-glass-local/30 to-glass-peer/20'
  },
  {
    icon: Bot,
    title: 'Connect an LLM',
    blurb: 'Local Ollama, or any API key you control.',
    tone: 'from-primary/30 to-glass-local/20'
  },
  {
    icon: ListChecks,
    title: 'Discover topics',
    blurb: 'Let AI surface what your library is really about.',
    tone: 'from-glass-peer/30 to-primary/20'
  }
]

/**
 * Lightweight launch-time welcome. Shows once per session on app startup
 * (unless the user has unchecked the welcomeOnStartup setting) and never
 * while the first-run setup wizard is in control of the screen.
 */
export function WelcomeOnLaunchDialog(): JSX.Element | null {
  const location = useLocation()
  const qc = useQueryClient()
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.settings.get(),
    staleTime: 30_000
  })
  const [dismissed, setDismissed] = useState(false)
  const [dontShowAgain, setDontShowAgain] = useState(false)

  const updateSetting = useMutation({
    mutationFn: (next: boolean) =>
      api.settings.update({ welcomeOnStartup: next }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] })
  })

  // Reset session-dismiss whenever the setting is flipped on in another part
  // of the app (e.g. Re-enable from Settings). Harmless no-op otherwise.
  useEffect(() => {
    if (settings?.welcomeOnStartup) setDismissed(false)
  }, [settings?.welcomeOnStartup])

  if (!settings) return null
  if (!settings.welcomeOnStartup) return null
  if (location.pathname === '/setup') return null

  const open = !dismissed
  const welcomeOn = settings.welcomeOnStartup

  function handleClose(): void {
    if (dontShowAgain && welcomeOn) {
      updateSetting.mutate(false)
    }
    setDismissed(true)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="max-w-xl overflow-hidden p-0">
        <WelcomeBackdrop />
        <div className="relative p-6">
          <DialogHeader>
            <div className="mb-2 inline-flex items-center gap-2 self-start rounded-full border border-primary/30 bg-background/60 px-3 py-0.5 text-[11px] font-medium text-primary backdrop-blur">
              <Sparkles className="h-3 w-3" />
              Welcome back
            </div>
            <DialogTitle className="text-2xl tracking-tight">
              Ready to explore{' '}
              <span className="bg-gradient-to-r from-glass-local via-primary to-glass-peer bg-clip-text text-transparent">
                {APP_NAME}?
              </span>
            </DialogTitle>
            <DialogDescription className="text-sm">
              Three easy steps turn your library into something you can actually search by idea.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-2">
            {STEPS.map((s, i) => {
              const Icon = s.icon
              return (
                <div
                  key={i}
                  className={`relative flex items-start gap-3 overflow-hidden rounded-lg bg-gradient-to-br ${s.tone} p-3`}
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-background/60 text-primary shadow-sm">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Step {i + 1}
                    </div>
                    <div className="text-sm font-semibold">{s.title}</div>
                    <div className="text-xs text-muted-foreground">{s.blurb}</div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-5 flex items-center justify-between gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="h-3 w-3 cursor-pointer accent-primary"
              />
              Don't show this on startup
            </label>
            <Button onClick={handleClose}>
              Let's go <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function WelcomeBackdrop(): JSX.Element {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full opacity-50"
      viewBox="0 0 600 400"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id="welcome-dialog-a" cx="15%" cy="20%" r="40%">
          <stop offset="0%" stopColor="hsl(var(--glass-local))" stopOpacity="0.22" />
          <stop offset="100%" stopColor="hsl(var(--glass-local))" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="welcome-dialog-b" cx="85%" cy="80%" r="45%">
          <stop offset="0%" stopColor="hsl(var(--glass-peer))" stopOpacity="0.22" />
          <stop offset="100%" stopColor="hsl(var(--glass-peer))" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="600" height="400" fill="url(#welcome-dialog-a)" />
      <rect width="600" height="400" fill="url(#welcome-dialog-b)" />
    </svg>
  )
}
