import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, Clipboard as ClipboardIcon, Cpu, FlaskConical, Link as LinkIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import type {
  ClassifiedFilename,
  ClassifyFileInput,
  ClassifierProvider,
  ClassifyProgress
} from '@shared/types'
import { ClipboardPromptView } from './ClipboardPromptView'

interface ClassifyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filenames: ClassifyFileInput[]
  onApplied: (labels?: ClassifiedFilename[]) => void
}

interface ProviderOption {
  id: ClassifierProvider
  label: string
  description: string
  icon: React.ReactNode
  requiresKey: boolean
  providerName?: string
}

const PROVIDERS: ProviderOption[] = [
  {
    id: 'claude',
    label: 'Claude',
    description: 'Anthropic Messages API',
    icon: <Bot className="h-4 w-4" />,
    requiresKey: true,
    providerName: 'Claude'
  },
  {
    id: 'openai',
    label: 'OpenAI',
    description: 'Chat Completions',
    icon: <Bot className="h-4 w-4" />,
    requiresKey: true,
    providerName: 'OpenAI'
  },
  {
    id: 'gemini',
    label: 'Gemini',
    description: 'Google generateContent',
    icon: <Bot className="h-4 w-4" />,
    requiresKey: true,
    providerName: 'Gemini'
  },
  {
    id: 'ollama',
    label: 'Ollama',
    description: 'Local model via http://localhost:11434',
    icon: <Cpu className="h-4 w-4" />,
    requiresKey: false,
    providerName: 'Ollama'
  },
  {
    id: 'mock',
    label: 'Mock (test)',
    description: 'Deterministic heuristic classifier — offline + free',
    icon: <FlaskConical className="h-4 w-4" />,
    requiresKey: false
  },
  {
    id: 'clipboard',
    label: 'Clipboard (paste yourself)',
    description: 'Copy prompt → run in browser → paste JSON back',
    icon: <ClipboardIcon className="h-4 w-4" />,
    requiresKey: false
  }
]

export function ClassifyDialog({
  open,
  onOpenChange,
  filenames,
  onApplied
}: ClassifyDialogProps): JSX.Element {
  const qc = useQueryClient()
  const { data: providers = [] } = useQuery({
    queryKey: ['llm-providers'],
    queryFn: () => api.llm.listProviders()
  })
  const keyedProviders = useMemo(
    () => new Set(providers.filter((p) => p.hasApiKey === 'Y').map((p) => p.providerName)),
    [providers]
  )
  const [selected, setSelected] = useState<ClassifierProvider>('mock')
  const [progress, setProgress] = useState<ClassifyProgress | null>(null)
  const [running, setRunning] = useState(false)

  // Hold onApplied in a ref so the progress-listener effect only depends on
  // `open`. Otherwise a parent passing an inline callback causes re-subscribe
  // on every render — events emitted between teardown and resubscribe get lost.
  const onAppliedRef = useRef(onApplied)
  useEffect(() => {
    onAppliedRef.current = onApplied
  }, [onApplied])

  useEffect(() => {
    if (!open) return
    const unsubscribe = api.filters.onClassifyProgress((p) => {
      setProgress(p)
      if (p.phase === 'done') {
        setRunning(false)
        qc.invalidateQueries({ queryKey: ['filter-preview'] })
        const failMsg = p.failedBatches ? ` (${p.failedBatches} batch failure${p.failedBatches === 1 ? '' : 's'})` : ''
        toast({
          title: `Classified ${p.completed} of ${p.total}${failMsg}`,
          variant: p.failedBatches ? 'default' : 'success'
        })
        onAppliedRef.current()
      } else if (p.phase === 'error') {
        setRunning(false)
        toast({ title: p.error ?? 'Classification failed', variant: 'destructive' })
      }
    })
    return unsubscribe
  }, [open, qc])

  const startRun = async (): Promise<void> => {
    if (selected === 'clipboard') return
    setRunning(true)
    setProgress({ jobId: '', phase: 'queued', completed: 0, total: filenames.length })
    try {
      await api.filters.classify({ provider: selected, filenames })
    } catch (err) {
      setRunning(false)
      toast({
        title: err instanceof Error ? err.message : 'Failed to start classification',
        variant: 'destructive'
      })
    }
  }

  const pct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.completed / progress.total) * 100))
      : 0

  const selectedOpt = PROVIDERS.find((p) => p.id === selected)!
  const keyMissing =
    selectedOpt.requiresKey &&
    selectedOpt.providerName !== undefined &&
    !keyedProviders.has(selectedOpt.providerName)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Classify {filenames.length} filenames with AI
          </DialogTitle>
          <DialogDescription>
            Each filename (no content, no OCR) is sent to the chosen model. Results are saved per file and used by the
            <code className="mx-1 rounded bg-muted px-1 text-[10px]">AI label =</code> filter rule.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {PROVIDERS.map((p) => {
              const pKeyMissing =
                p.requiresKey && p.providerName !== undefined && !keyedProviders.has(p.providerName)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(p.id)}
                  disabled={running}
                  className={cn(
                    'flex items-start gap-2 rounded-md border p-2 text-left text-xs transition-colors',
                    selected === p.id
                      ? 'border-primary/60 bg-primary/10'
                      : 'border-border hover:bg-accent/40',
                    running && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <span className="mt-0.5 text-muted-foreground">{p.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{p.label}</span>
                    <span className="block text-[11px] text-muted-foreground">{p.description}</span>
                    {pKeyMissing && (
                      <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                        <LinkIcon className="h-2.5 w-2.5" /> API key not configured — set it on the LLMs page
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>

          {selected === 'clipboard' ? (
            <ClipboardPromptView
              filenames={filenames}
              onApplied={(labels) => {
                onApplied(labels)
                qc.invalidateQueries({ queryKey: ['filter-preview'] })
              }}
            />
          ) : (
            <div className="space-y-3">
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold">
                    {running ? `${progress?.phase ?? 'starting'}…` : 'Ready'}
                  </span>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {progress ? `${progress.completed} / ${progress.total}` : `0 / ${filenames.length}`}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-gradient-to-r from-glass-local to-glass-peer transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {progress?.currentBatch !== undefined && running && (
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    Running batch {progress.currentBatch}
                    {progress.failedBatches ? ` · ${progress.failedBatches} failure${progress.failedBatches === 1 ? '' : 's'}` : ''}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={running}>
                  Close
                </Button>
                <Button type="button" onClick={startRun} disabled={running || keyMissing || filenames.length === 0}>
                  {running ? 'Classifying…' : `Classify with ${selectedOpt.label}`}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
