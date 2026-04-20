import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, Info, HelpCircle, Check, X, Loader2, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import type { LlmProvider, LlmTestResult } from '@shared/types'
import { OnboardingDialog } from './OnboardingDialog'
import { PROVIDER_GUIDES, type ProviderGuide } from './provider-onboarding'

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

      <PrivacyCallout />

      <Card>
        <CardHeader>
          <CardTitle>Providers</CardTitle>
          <CardDescription>
            Enable a provider by adding an API key (or running Ollama locally). The provider set as default is used when a feature doesn't override it.
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
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="flex gap-3 p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-amber-300">Before sharing expertise with remote LLMs</p>
          <p className="text-amber-100/90">
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
  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: () => api.llm.listProviders()
  })

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }
  return (
    <div className="space-y-3">
      {providers.map((p) => (
        <ProviderCard key={p.providerId} provider={p} onOpenOnboarding={onOpenOnboarding} />
      ))}
    </div>
  )
}

function ProviderCard({
  provider,
  onOpenOnboarding
}: {
  provider: LlmProvider
  onOpenOnboarding: (guide: ProviderGuide) => void
}) {
  const qc = useQueryClient()
  const [showKey, setShowKey] = useState(false)
  const [keyDraft, setKeyDraft] = useState(provider.apiKey)
  const [testResult, setTestResult] = useState<LlmTestResult | null>(null)

  const updateKey = useMutation({
    mutationFn: (key: string) => api.llm.updateKey(provider.providerId, key),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['providers'] })
  })

  const testConnection = useMutation({
    mutationFn: () => api.llm.testConnection(provider.providerId),
    onSuccess: (result) => setTestResult(result)
  })

  const guide = PROVIDER_GUIDES[provider.providerName]
  const hasKey = provider.hasApiKey === 'Y'
  const isOllama = provider.providerName === 'Ollama'

  return (
    <div className="rounded-md border border-border bg-card/60 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{provider.providerName}</span>
          {provider.isDefault === 'Y' && <Badge variant="outline">Default</Badge>}
          {isOllama ? (
            <Badge variant="secondary">Local</Badge>
          ) : hasKey ? (
            <Badge variant="success">Key set</Badge>
          ) : (
            <Badge variant="outline">No key</Badge>
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

      {!isOllama && (
        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              type={showKey ? 'text' : 'password'}
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              placeholder={guide?.keyPlaceholder ?? 'Paste API key'}
              className="pr-10 font-mono text-xs"
              onBlur={() => {
                if (keyDraft !== provider.apiKey) updateKey.mutate(keyDraft)
              }}
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
        </div>
      )}
      {isOllama && (
        <div className="mt-3 flex items-center gap-2">
          <p className="flex-1 text-xs text-muted-foreground">
            No key required. Make sure the Ollama service is running on{' '}
            <span className="font-mono">{provider.apiHost}</span>.
          </p>
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
        </div>
      )}

      {testResult && <TestResultLine result={testResult} />}
    </div>
  )
}

function TestResultLine({ result }: { result: LlmTestResult }) {
  return (
    <div
      className={cn(
        'mt-2 flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs',
        result.ok
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          : 'border-destructive/30 bg-destructive/10 text-destructive'
      )}
    >
      {result.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {result.ok ? (
        <span>
          Connected — <span className="font-mono">{result.latencyMs} ms</span>
        </span>
      ) : (
        <span>Failed: {result.error}</span>
      )}
      <Info className="ml-auto h-3 w-3 opacity-60" />
    </div>
  )
}
