import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Eye,
  EyeOff,
  ExternalLink,
  HelpCircle,
  Check,
  X,
  Loader2,
  Lock,
  ShieldAlert,
  RefreshCw,
  Sparkles,
  Laptop,
  Cloud
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import type { LlmDiscoverResult, LlmProvider, LlmTestResult } from '@shared/types'
import { HelpHint } from '@/components/ui/help-hint'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { OnboardingDialog } from './OnboardingDialog'
import { PROVIDER_GUIDES, type ProviderGuide } from './provider-onboarding'
import { ProviderHub } from '@/components/visual/ProviderHub'
import { isLocalProvider } from '@shared/providers'
import { USAGE_DASHBOARD_URL } from './dashboard-urls'
import { OpenAiUsageInline } from './OpenAiUsageInline'
import { SkeletonRows } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/visual/EmptyState'
import { QueryErrorState } from '@/components/visual/QueryErrorState'
import { useBurst } from '@/components/visual/Burst'

const BRAND: Record<
  string,
  { solid: string; tint: string; initial: string }
> = {
  Ollama: { solid: '#8B5CF6', tint: 'rgba(139, 92, 246, 0.15)', initial: 'O' },
  OpenAI: { solid: '#10A37F', tint: 'rgba(16, 163, 127, 0.15)', initial: 'O' },
  Claude: { solid: '#D97757', tint: 'rgba(217, 119, 87, 0.15)', initial: 'C' },
  Gemini: { solid: '#4285F4', tint: 'rgba(66, 133, 244, 0.15)', initial: 'G' },
  HuggingFace: { solid: '#FF9D00', tint: 'rgba(255, 157, 0, 0.15)', initial: 'H' },
  'LM Studio': { solid: '#0EA5E9', tint: 'rgba(14, 165, 233, 0.15)', initial: 'L' },
  Default: { solid: '#6366F1', tint: 'rgba(99, 102, 241, 0.12)', initial: '?' }
}

function BrandBadge({
  providerName,
  active
}: {
  providerName: string
  active: boolean
}): JSX.Element {
  const brand = BRAND[providerName] ?? BRAND.Default
  return (
    <div
      className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white"
      style={{
        backgroundColor: active ? brand.solid : 'hsl(var(--muted-foreground) / 0.3)'
      }}
    >
      {brand.initial}
    </div>
  )
}

export default function LlmPage() {
  const [onboardingFor, setOnboardingFor] = useState<ProviderGuide | null>(null)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">LLMs</h1>
        <p className="text-sm text-muted-foreground">
          Configure providers and API keys. SCL stores keys locally in SQLite and never transmits them except to the provider you've chosen.
        </p>
      </div>

      <ProviderHub />

      <PrivacyCallout />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Providers
            <HelpHint
              size="sm"
              label="Each card is one AI service SCL can talk to. Paste the provider's API key, click Test to confirm auth, then Refresh models to pull the live model list. The provider marked Default is used by features that don't pick one explicitly (e.g. Topic generation)."
            />
          </CardTitle>
          <CardDescription>
            Local providers run on your PC and need no key. Cloud providers need an API key. The provider marked Default is used by features that don't pick one explicitly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProvidersList onOpenOnboarding={setOnboardingFor} />
        </CardContent>
      </Card>

      <OnboardingDialog
        guide={onboardingFor}
        open={!!onboardingFor}
        onOpenChange={(open) => !open && setOnboardingFor(null)}
      />
    </div>
  )
}

function PrivacyCallout() {
  return (
    <Card className="border-amber-500/50 bg-amber-500/10 dark:border-amber-500/30 dark:bg-amber-500/5">
      <CardContent className="flex gap-3 p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" />
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-amber-900 dark:text-amber-300">
            Before sharing expertise with remote LLMs
          </p>
          <p className="text-amber-800/95 dark:text-amber-100/90">
            Commercial LLM providers may learn from your queries and eventually redistribute that knowledge. Use remote providers only for <b>busy-work</b> (summarization, renaming, routine classification). For work where your expertise is the asset, prefer local models via Ollama.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function ProvidersList({
  onOpenOnboarding
}: {
  onOpenOnboarding: (guide: ProviderGuide) => void
}) {
  const query = useQuery({
    queryKey: ['providers'],
    queryFn: () => api.llm.listProviders()
  })

  if (query.isLoading) {
    return <SkeletonRows count={3} />
  }
  if (query.isError) {
    return (
      <QueryErrorState
        title="Couldn't load LLM providers"
        error={query.error as Error}
        onRetry={() => void query.refetch()}
      />
    )
  }
  const providers = query.data ?? []
  if (providers.length === 0) {
    return (
      <EmptyState
        variant="generic"
        title="No providers configured"
        description="Providers seed on first launch — if this list is empty, the migration may have failed. Check Settings → Errors."
      />
    )
  }

  // Split providers into Local / Cloud sections so the user doesn't have
  // to scan six identical cards to choose. Local goes first because it's
  // the recommended starting point (no key, no per-token cost, no data
  // leaving the machine). The "Start here" highlight on Ollama lights up
  // when no CLOUD keys have been added yet — a brand-new user benefits
  // from the nudge; once they've pasted any cloud key the badge goes
  // away. (Local providers are always pre-seeded, so a heuristic that
  // treated "any local present" as "configured" was permanently dead.)
  const localProviders = providers.filter((p) => isLocalProvider(p.providerName))
  const cloudProviders = providers.filter((p) => !isLocalProvider(p.providerName))
  const anyCloudKey = cloudProviders.some((p) => p.hasApiKey === 'Y')
  const recommendStart = !anyCloudKey

  return (
    <div className="space-y-6">
      {localProviders.length > 0 && (
        <ProviderSection
          icon={<Laptop className="h-3.5 w-3.5" />}
          title="Local — runs on your PC"
          subtitle="No API key. No data leaves the machine. Recommended for sensitive work."
        >
          {localProviders.map((p) => (
            <ProviderCard
              key={p.providerId}
              provider={p}
              onOpenOnboarding={onOpenOnboarding}
              recommended={recommendStart && p.providerName === 'Ollama'}
            />
          ))}
        </ProviderSection>
      )}
      {cloudProviders.length > 0 && (
        <ProviderSection
          icon={<Cloud className="h-3.5 w-3.5" />}
          title="Cloud — requires an API key"
          subtitle="Faster on commodity hardware, but provider may learn from your queries."
        >
          {cloudProviders.map((p) => (
            <ProviderCard
              key={p.providerId}
              provider={p}
              onOpenOnboarding={onOpenOnboarding}
              recommended={false}
            />
          ))}
        </ProviderSection>
      )}
    </div>
  )
}

function ProviderSection({
  icon,
  title,
  subtitle,
  children
}: {
  icon: JSX.Element
  title: string
  subtitle: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2 border-b border-border/60 pb-1">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {icon}
          {title}
        </span>
        <span className="text-[11px] text-muted-foreground/80">{subtitle}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function ProviderCard({
  provider,
  onOpenOnboarding,
  recommended
}: {
  provider: LlmProvider
  onOpenOnboarding: (guide: ProviderGuide) => void
  recommended: boolean
}) {
  const qc = useQueryClient()
  const [showKey, setShowKey] = useState(false)
  // The input always starts empty — provider.apiKey no longer crosses the
  // IPC boundary, so the renderer cannot pre-fill the existing value. A
  // configured key is presented as a placeholder ("Key configured — paste
  // a new one to replace") rather than the actual stored value. The user
  // can verify the key works via the Test button without ever seeing it.
  const [keyDraft, setKeyDraft] = useState('')
  const [testResult, setTestResult] = useState<LlmTestResult | null>(null)
  const [discoverResult, setDiscoverResult] = useState<LlmDiscoverResult | null>(null)
  // Transient "Saved" check next to the key input — fires on a successful
  // updateKey mutation and clears after a short delay. Without this the
  // user gets no feedback that their paste actually persisted.
  const [keySaved, setKeySaved] = useState(false)
  const savedTimer = useRef<number | null>(null)
  // One-shot burst on Test success so the Peak-End moment lands.
  const { burst, trigger: fireSuccessBurst } = useBurst({
    particleCount: 8,
    distance: 36,
    durationMs: 500,
    colorClass: 'bg-emerald-400',
    ringColorClass: 'border-emerald-400/60'
  })

  const updateKey = useMutation({
    mutationFn: (key: string) => api.llm.updateKey(provider.providerId, key),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['providers'] })
      // Clear the draft post-save so the freshly-pasted secret doesn't
      // linger in renderer state any longer than necessary. Re-pasting is
      // also the only way to overwrite a stored key, so empty-after-save
      // matches the intended UX (placeholder reads "Key configured…").
      setKeyDraft('')
      setShowKey(false)
      setKeySaved(true)
      if (savedTimer.current) window.clearTimeout(savedTimer.current)
      savedTimer.current = window.setTimeout(() => setKeySaved(false), 1800)
    }
  })

  // Cleanup: clear the saved-toast timer on unmount so a card unmount
  // mid-flight doesn't leak a setState into a dead component.
  useEffect(() => {
    return () => {
      if (savedTimer.current) window.clearTimeout(savedTimer.current)
    }
  }, [])

  const testConnection = useMutation({
    mutationFn: () => api.llm.testConnection(provider.providerId),
    onSuccess: (result) => {
      setTestResult(result)
      if (result.ok) fireSuccessBurst()
    }
  })

  const discoverModels = useMutation({
    mutationFn: () => api.llm.discoverModels(provider.providerId),
    onSuccess: (result) => {
      setDiscoverResult(result)
      qc.invalidateQueries({ queryKey: ['models', provider.providerId] })
    }
  })

  const guide = PROVIDER_GUIDES[provider.providerName]
  const hasKey = provider.hasApiKey === 'Y'
  const isLocal = isLocalProvider(provider.providerName)
  const brand = BRAND[provider.providerName] ?? BRAND.Default
  const active = isLocal || hasKey

  // Wipe the prior Test/Discover verdict whenever the user edits the key
  // — a stale "Connected — 312 ms" sitting next to a half-edited key is
  // worse than no verdict at all.
  const onKeyChange = (next: string): void => {
    setKeyDraft(next)
    if (testResult) setTestResult(null)
    if (discoverResult) setDiscoverResult(null)
  }

  const persistKeyIfDirty = (): void => {
    // The renderer no longer holds the stored key, so "dirty" simply means
    // "the user typed something." An empty blur is treated as a no-op so
    // tabbing past the input doesn't accidentally clear an existing key.
    if (keyDraft !== '') updateKey.mutate(keyDraft)
  }

  // Test gate: don't fire while a key save is in flight; the test would
  // race the new key onto the wire and could verify against the OLD key
  // depending on which mutation completes first. We wait for the save.
  const testDisabled = testConnection.isPending || updateKey.isPending
  const discoverDisabled = discoverModels.isPending || updateKey.isPending || (!isLocal && !hasKey)

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md border bg-card/60 p-4',
        recommended ? 'border-primary/50 ring-2 ring-primary/30' : 'border-border'
      )}
      style={{
        backgroundImage: active
          ? `linear-gradient(135deg, ${brand.tint} 0%, transparent 40%)`
          : undefined
      }}
    >
      {recommended && (
        <Badge
          variant="accent"
          className="absolute right-3 top-3 gap-1 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider"
        >
          <Sparkles className="h-3 w-3" /> Start here
        </Badge>
      )}
      <div
        aria-hidden
        className="absolute left-0 top-0 h-full w-1"
        style={{ backgroundColor: active ? brand.solid : 'hsl(var(--muted))' }}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BrandBadge providerName={provider.providerName} active={active} />
          <span className="font-semibold" style={{ color: active ? brand.solid : undefined }}>
            {provider.providerName}
          </span>
          {provider.isDefault === 'Y' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span><Badge variant="outline">Default</Badge></span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Used by features that don't specify a provider. Exactly one provider is the default at any time.
              </TooltipContent>
            </Tooltip>
          )}
          {isLocal ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span><Badge variant="secondary">Local</Badge></span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Runs entirely on your PC. Nothing leaves the machine. No API key required — just start the local server.
              </TooltipContent>
            </Tooltip>
          ) : hasKey ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span><Badge variant="success">Key set</Badge></span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                An API key is stored. Hasn't been validated yet — click Test to confirm it actually works.
              </TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span><Badge variant="outline">No key</Badge></span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Provider isn't usable yet. Paste an API key to enable it.
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {guide && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenOnboarding(guide)}
            className="text-xs"
          >
            <HelpCircle className="mr-1 h-3 w-3" />
            How do I get a key?
          </Button>
        )}
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        Host: <span className="font-mono">{provider.apiHost || '—'}</span>
      </p>

      {!isLocal && (
        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              type={showKey ? 'text' : 'password'}
              value={keyDraft}
              onChange={(e) => onKeyChange(e.target.value)}
              placeholder={
                hasKey
                  ? 'Key configured — paste a new one to replace'
                  : guide?.keyPlaceholder ?? 'Paste API key'
              }
              className="pr-10 font-mono text-xs"
              onBlur={persistKeyIfDirty}
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              title={showKey ? 'Hide' : 'Show'}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => testConnection.mutate()}
              disabled={testDisabled}
            >
              {testConnection.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : null}
              Test
            </Button>
            {burst}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => discoverModels.mutate()}
            disabled={discoverDisabled}
            title={hasKey ? 'Fetch model list from provider' : 'Add an API key first'}
          >
            {discoverModels.isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-3 w-3" />
            )}
            Refresh models
          </Button>
        </div>
      )}
      {!isLocal && (
        // Reassurance + save-confirmation line, anchored to the input
        // because that's the moment the user is anxious about pasting.
        <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Lock className="h-3 w-3" />
            Stored locally in SQLite — sent only to {provider.providerName} when needed.
          </span>
          {keySaved && (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Check className="h-3 w-3" />
              Saved
            </span>
          )}
          {updateKey.isPending && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving…
            </span>
          )}
        </div>
      )}
      {isLocal && (
        <div className="mt-3 flex items-center gap-2">
          <p className="flex-1 text-xs text-muted-foreground">
            No key required. Make sure the {provider.providerName} service is running on{' '}
            <span className="font-mono">{provider.apiHost}</span>.
          </p>
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => testConnection.mutate()}
              disabled={testConnection.isPending}
            >
              {testConnection.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : null}
              Test
            </Button>
            {burst}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => discoverModels.mutate()}
            disabled={discoverModels.isPending}
          >
            {discoverModels.isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-3 w-3" />
            )}
            Refresh models
          </Button>
        </div>
      )}

      {testResult && <TestResultLine result={testResult} providerName={provider.providerName} />}
      {discoverResult && <DiscoverResultLine result={discoverResult} />}
      <UsageRow provider={provider} />
    </div>
  )
}

function UsageRow({ provider }: { provider: LlmProvider }): JSX.Element | null {
  // Local providers run on the user's own machine — no remote billing to
  // visit. Skip the row entirely. Cloud providers get the dashboard link
  // unconditionally (lets the user log in / verify account state even when
  // no key is configured yet).
  if (isLocalProvider(provider.providerName)) return null
  const url = USAGE_DASHBOARD_URL[provider.providerName]
  if (!url) return null
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <Button
        variant="link"
        size="sm"
        className="h-auto gap-1 px-0 text-xs"
        onClick={() => window.electronAPI.app.openExternal(url)}
      >
        <ExternalLink className="h-3 w-3" />
        Open usage dashboard
      </Button>
      {provider.providerName === 'OpenAI' && provider.hasApiKey === 'Y' && (
        <OpenAiUsageInline providerId={provider.providerId} />
      )}
    </div>
  )
}

function DiscoverResultLine({ result }: { result: LlmDiscoverResult }) {
  // Hover to see the full model list when the truncated tail elides
  // anything beyond the first three names. Without this the `+12`
  // suffix had no way to expand and the discovery had no destination.
  const fullList = result.models && result.models.length > 0 ? result.models.join('\n') : null
  return (
    <div
      className={cn(
        'mt-2 flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs',
        result.ok
          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
          : 'border-destructive/30 bg-destructive/10 text-destructive'
      )}
    >
      {result.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {result.ok ? (
        <span className="flex-1 truncate">
          Discovered {result.count} model{result.count === 1 ? '' : 's'}
          {result.fallback ? ' (fallback list)' : ''}
          {result.models && result.models.length > 0 && (
            fullList && result.models.length > 3 ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="ml-2 cursor-help font-mono opacity-70 underline decoration-dotted">
                    {result.models.slice(0, 3).join(', ')}
                    , +{result.models.length - 3}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-md">
                  <pre className="whitespace-pre-wrap font-mono text-[10px]">{fullList}</pre>
                </TooltipContent>
              </Tooltip>
            ) : (
              <span className="ml-2 font-mono opacity-70">
                {result.models.join(', ')}
              </span>
            )
          )}
        </span>
      ) : (
        <span>Failed: {result.error}</span>
      )}
    </div>
  )
}

function TestResultLine({
  result,
  providerName
}: {
  result: LlmTestResult
  providerName: string
}) {
  const grade = result.ok && result.latencyMs !== undefined ? gradeLatency(result.latencyMs) : null
  return (
    <div
      className={cn(
        'mt-2 flex items-center gap-2 rounded-md border px-3 py-2 text-xs animate-in fade-in slide-in-from-top-1',
        result.ok
          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
          : 'border-destructive/30 bg-destructive/10 text-destructive'
      )}
    >
      {result.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
      {result.ok ? (
        <span>
          Connected to <b>{providerName}</b>
          {result.latencyMs !== undefined && (
            <> — <span className="font-mono">{result.latencyMs} ms</span></>
          )}
          {grade && <span className="ml-1 italic opacity-70">({grade})</span>}
        </span>
      ) : (
        <span>Failed: {result.error}</span>
      )}
    </div>
  )
}

// Latency thresholds tuned for HTTP round-trips against an LLM
// completion endpoint: < 300 ms is local-network-fast; < 1 s is normal
// for cloud providers in the same region; anything over 2 s suggests
// a coast-far-from-the-DC edge case and is worth flagging.
function gradeLatency(ms: number): string {
  if (ms < 300) return 'fast'
  if (ms < 1000) return 'good'
  if (ms < 2000) return 'ok'
  return 'slow'
}
