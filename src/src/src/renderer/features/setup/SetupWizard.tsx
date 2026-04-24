import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FolderPlus,
  Loader2,
  Plus,
  Rocket,
  ShieldCheck,
  Sparkles,
  Trash2,
  Bot
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { APP_NAME } from '@/lib/app-info'
import type { FolderRow, LlmProvider, LlmTestResult } from '@shared/types'

const STEP_LABELS = ['Welcome', 'Folders', 'LLM', 'Done'] as const

export default function SetupWizard(): JSX.Element {
  const [step, setStep] = useState(0)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const finishMutation = useMutation({
    mutationFn: () => api.settings.update({ setupCompleted: true })
  })

  // Flip the setup-completed flag as soon as the user has seen the wizard.
  // If they close the window mid-flow or walk away without clicking "Go to
  // Dashboard", we still don't want to re-prompt on next launch — they know
  // about the wizard and can re-run it from Settings. The fields the wizard
  // sets (folders, LLM) persist independently of the flag.
  const markedRef = useRef(false)
  useEffect(() => {
    if (markedRef.current) return
    markedRef.current = true
    api.settings
      .update({ setupCompleted: true })
      .then(() => qc.invalidateQueries({ queryKey: ['settings'] }))
  }, [qc])

  async function finish(): Promise<void> {
    await finishMutation.mutateAsync()
    await qc.invalidateQueries({ queryKey: ['settings'] })
    navigate('/dashboard', { replace: true })
  }

  const canGoBack = step > 0 && step < STEP_LABELS.length - 1
  const isLast = step === STEP_LABELS.length - 1

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-gradient-to-br from-primary/10 via-background to-glass-peer/10">
      <SetupBackdrop />
      <div className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col px-8 py-8">
        <Stepper current={step} />
        <div className="mt-8 flex-1 min-h-0 overflow-y-auto">
          {step === 0 && <WelcomeStep onNext={() => setStep(1)} />}
          {step === 1 && <FoldersStep onNext={() => setStep(2)} onSkip={() => setStep(2)} />}
          {step === 2 && <LlmStep onNext={() => setStep(3)} onSkip={() => setStep(3)} />}
          {step === 3 && <DoneStep onFinish={finish} busy={finishMutation.isPending} />}
        </div>
        <div className="mt-6 flex items-center justify-between">
          {canGoBack ? (
            <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
              <ArrowLeft className="h-3 w-3" /> Back
            </Button>
          ) : (
            <div />
          )}
          {!isLast && step > 0 && (
            <Button variant="link" size="sm" onClick={() => setStep(step + 1)}>
              Skip for now
            </Button>
          )}
          {isLast && (
            <Button onClick={finish} disabled={finishMutation.isPending}>
              Go to Dashboard <ArrowRight className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function Stepper({ current }: { current: number }): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      {STEP_LABELS.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={label} className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold',
                active && 'bg-primary text-primary-foreground',
                done && 'bg-emerald-500 text-white',
                !active && !done && 'bg-muted text-muted-foreground'
              )}
            >
              {done ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
            </div>
            <span
              className={cn(
                'text-xs font-medium',
                active ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {label}
            </span>
            {i < STEP_LABELS.length - 1 && (
              <span className="h-px w-6 bg-border" />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------- Step 1: Welcome ----------

function WelcomeStep({ onNext }: { onNext: () => void }): JSX.Element {
  const tiles = [
    {
      icon: <FolderPlus className="h-4 w-4" />,
      title: 'Pick folders',
      blurb: 'Point us at your PDFs and eBooks.'
    },
    {
      icon: <Bot className="h-4 w-4" />,
      title: 'Configure an LLM',
      blurb: 'Local Ollama or an API key you control.'
    },
    {
      icon: <Rocket className="h-4 w-4" />,
      title: 'Off you go',
      blurb: 'Scan, classify, review topics.'
    }
  ]
  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-background/60 px-3 py-0.5 text-[11px] font-medium text-primary">
          <Sparkles className="h-3 w-3" />
          Welcome
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Let's get{' '}
          <span className="bg-gradient-to-r from-glass-local via-primary to-glass-peer bg-clip-text text-transparent">
            {APP_NAME}
          </span>{' '}
          set up.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This takes about two minutes. You can skip steps and finish them later from the sidebar.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {tiles.map((t, i) => (
          <div
            key={i}
            className="rounded-lg border border-border/60 bg-card/40 p-4"
          >
            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
              {t.icon}
            </div>
            <div className="text-sm font-semibold">{t.title}</div>
            <div className="mt-1 text-xs text-muted-foreground">{t.blurb}</div>
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <Button onClick={onNext}>
          Let's go <ArrowRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

// ---------- Step 2: Folders ----------

function FoldersStep({
  onNext,
  onSkip
}: {
  onNext: () => void
  onSkip: () => void
}): JSX.Element {
  const qc = useQueryClient()
  const { data: folders = [] } = useQuery({
    queryKey: ['folders'],
    queryFn: () => api.folders.list()
  })
  const pickAndAdd = useMutation({
    mutationFn: async () => {
      const paths = await api.folders.pickDirectory()
      if (paths.length > 0) await api.folders.add(paths)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['folders'] })
  })
  const removeFolder = useMutation({
    mutationFn: (id: number) => api.folders.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['folders'] })
  })

  const included = folders.filter((f) => f.include === 'Y')

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Pick folders to scan</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Point {APP_NAME} at the directories that hold your eBooks, papers, or notes. Subfolders you don't want are added as excludes automatically.
        </p>
      </div>

      <div className="rounded-md border border-border/60">
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-3 py-2">
          <span className="text-xs font-semibold">Indexed folders</span>
          <Button size="sm" onClick={() => pickAndAdd.mutate()} disabled={pickAndAdd.isPending}>
            <Plus className="h-3 w-3" /> Add folder
          </Button>
        </div>
        {folders.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No folders yet. Click <strong>Add folder</strong> above to pick one.
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {folders.map((f) => (
              <FolderRowView
                key={f.id}
                row={f}
                onRemove={() => removeFolder.mutate(f.id)}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {included.length > 0
            ? `${included.length} folder${included.length === 1 ? '' : 's'} will be scanned`
            : 'Add at least one folder — or skip to decide later'}
        </span>
        <Button onClick={onNext} disabled={included.length === 0 && !pickAndAdd.isPending}>
          {included.length > 0 ? 'Continue' : 'Skip'} <ArrowRight className="h-3 w-3" />
        </Button>
      </div>
      <div className="text-center">
        {included.length === 0 && (
          <button
            type="button"
            onClick={onSkip}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            I'll add folders later
          </button>
        )}
      </div>
    </div>
  )
}

function FolderRowView({
  row,
  onRemove
}: {
  row: FolderRow
  onRemove: () => void
}): JSX.Element {
  return (
    <li className="flex items-center gap-3 px-3 py-2 text-sm">
      <Badge
        variant="secondary"
        className={cn(
          'text-[10px]',
          row.include === 'Y'
            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
            : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
        )}
      >
        {row.include === 'Y' ? 'include' : 'exclude'}
      </Badge>
      <span className="flex-1 truncate font-mono text-xs">{row.path}</span>
      <Button size="sm" variant="ghost" onClick={onRemove}>
        <Trash2 className="h-3 w-3" />
      </Button>
    </li>
  )
}

// ---------- Step 3: LLM ----------

function LlmStep({
  onNext,
  onSkip
}: {
  onNext: () => void
  onSkip: () => void
}): JSX.Element {
  const qc = useQueryClient()
  const { data: providers = [] } = useQuery({
    queryKey: ['llm-providers'],
    queryFn: () => api.llm.listProviders()
  })
  const updateKey = useMutation({
    mutationFn: ({ providerId, key }: { providerId: number; key: string }) =>
      api.llm.updateKey(providerId, key),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['llm-providers'] })
  })

  const anyConfigured = providers.some(
    (p) => p.hasApiKey === 'Y' || p.providerName === 'Ollama'
  )

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Connect an LLM</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick one. Ollama runs locally with no key needed; the others need an API key you provide. You can add more later from the LLMs page.
        </p>
      </div>

      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-[11px] text-amber-800 dark:text-amber-300">
        <ShieldCheck className="mr-1 inline h-3 w-3" />
        Commercial LLMs may learn from your data. Prefer Ollama for sensitive work.
      </div>

      <div className="space-y-2">
        {providers.map((p) => (
          <ProviderRow
            key={p.providerId}
            provider={p}
            onSaveKey={(key) => updateKey.mutate({ providerId: p.providerId, key })}
            saving={updateKey.isPending}
          />
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {anyConfigured
            ? 'Looks good — at least one provider is ready.'
            : 'Add an API key or use Ollama. Or skip for now.'}
        </span>
        <Button onClick={onNext}>
          {anyConfigured ? 'Continue' : 'Skip'} <ArrowRight className="h-3 w-3" />
        </Button>
      </div>
      <div className="text-center">
        {!anyConfigured && (
          <button
            type="button"
            onClick={onSkip}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            I'll configure an LLM later
          </button>
        )}
      </div>
    </div>
  )
}

function ProviderRow({
  provider,
  onSaveKey,
  saving
}: {
  provider: LlmProvider
  onSaveKey: (key: string) => void
  saving: boolean
}): JSX.Element {
  const [draft, setDraft] = useState('')
  const [testResult, setTestResult] = useState<LlmTestResult | null>(null)
  const [testing, setTesting] = useState(false)
  const isOllama = provider.providerName === 'Ollama'

  async function test(): Promise<void> {
    setTesting(true)
    try {
      const r = await api.llm.testConnection(provider.providerId)
      setTestResult(r)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="rounded-md border border-border/60 bg-card/40 p-3">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold">
            {provider.providerName}
            {provider.hasApiKey === 'Y' && (
              <Badge variant="secondary" className="bg-emerald-500/15 text-[10px] text-emerald-700 dark:text-emerald-400">
                key set
              </Badge>
            )}
            {isOllama && (
              <Badge variant="secondary" className="bg-primary/15 text-[10px] text-primary">
                local, no key needed
              </Badge>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground">{provider.apiHost}</div>
        </div>
        <Button size="sm" variant="outline" onClick={test} disabled={testing}>
          {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Test'}
        </Button>
      </div>
      {!isOllama && (
        <div className="mt-2 flex items-center gap-2">
          <Input
            type="password"
            placeholder="paste API key…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="flex-1 text-xs"
          />
          <Button
            size="sm"
            onClick={() => {
              if (draft.trim()) {
                onSaveKey(draft)
                setDraft('')
              }
            }}
            disabled={saving || !draft.trim()}
          >
            Save key
          </Button>
        </div>
      )}
      {testResult && (
        <div
          className={cn(
            'mt-2 text-[11px]',
            testResult.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
          )}
        >
          {testResult.ok
            ? `Connected (${testResult.latencyMs}ms)`
            : `Error: ${testResult.error}`}
        </div>
      )}
    </div>
  )
}

// ---------- Step 4: Done ----------

function DoneStep({
  onFinish,
  busy
}: {
  onFinish: () => void
  busy: boolean
}): JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center space-y-5 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">You're all set.</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {APP_NAME} will start scanning any folders you added. You can configure more any time from the sidebar.
        </p>
      </div>
      <Button size="lg" onClick={onFinish} disabled={busy}>
        Go to Dashboard <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

// ---------- Backdrop ----------

function SetupBackdrop(): JSX.Element {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full opacity-60"
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id="setup-glow-a" cx="20%" cy="20%" r="45%">
          <stop offset="0%" stopColor="hsl(var(--glass-local))" stopOpacity="0.25" />
          <stop offset="100%" stopColor="hsl(var(--glass-local))" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="setup-glow-b" cx="80%" cy="75%" r="50%">
          <stop offset="0%" stopColor="hsl(var(--glass-peer))" stopOpacity="0.25" />
          <stop offset="100%" stopColor="hsl(var(--glass-peer))" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#setup-glow-a)" />
      <rect width="1200" height="800" fill="url(#setup-glow-b)" />
    </svg>
  )
}
