import { useQuery, useMutation } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Loader2, Send, Sparkles, Clock, Coins, Check, X, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import type { ChatMessage, LlmCompleteResult, LlmProvider } from '@shared/types'

const DEFAULT_PROVIDER_VALUE = ''  // sentinel — empty string means "use the configured default"

/**
 * Dev-only LLM Playground. Exposes the new `llm:complete` IPC end-to-end so we
 * can verify (a) the configured default provider responds, (b) model selection
 * fallback works, (c) the LLM_Usage row is written with the right metadata.
 *
 * Not meant to be a polished chat UI — it's a verification harness. One-shot
 * exchanges only (no conversation history within the harness; multi-turn is
 * supported in the underlying IPC, this UI just doesn't accumulate it).
 */
export function LlmPlaygroundTab(): JSX.Element {
  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => api.llm.listProviders()
  })

  const [providerId, setProviderId] = useState<string>(DEFAULT_PROVIDER_VALUE)
  const [modelOverride, setModelOverride] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [userPrompt, setUserPrompt] = useState('reply with the single word PONG')
  const [temperature, setTemperature] = useState(0.2)
  const [maxTokens, setMaxTokens] = useState(1024)
  const [responseFormat, setResponseFormat] = useState<'text' | 'json'>('text')
  const [history, setHistory] = useState<Array<{ ts: number; result: LlmCompleteResult }>>([])

  // Models for the currently-picked provider (or default provider).
  const resolvedProvider = useResolvedProvider(providers, providerId)
  const { data: models = [] } = useQuery({
    queryKey: ['models', resolvedProvider?.providerId],
    queryFn: () =>
      resolvedProvider
        ? api.llm.listModels(resolvedProvider.providerId)
        : Promise.resolve([]),
    enabled: !!resolvedProvider
  })

  const sendMutation = useMutation({
    mutationFn: () => {
      const messages: ChatMessage[] = []
      if (systemPrompt.trim()) {
        messages.push({ role: 'system', content: systemPrompt.trim() })
      }
      messages.push({ role: 'user', content: userPrompt })
      return api.llm.complete({
        messages,
        providerId: providerId === DEFAULT_PROVIDER_VALUE ? undefined : Number(providerId),
        modelName: modelOverride.trim() || undefined,
        temperature,
        maxTokens,
        responseFormat,
        feature: 'playground'
      })
    },
    onSuccess: (result) => {
      setHistory((h) => [{ ts: Date.now(), result }, ...h].slice(0, 5))
    }
  })

  const canSend = userPrompt.trim().length > 0 && !sendMutation.isPending

  return (
    <div className="space-y-4 pb-2">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4" /> LLM Playground
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          One-shot chat completion via <code className="rounded bg-muted px-1 font-mono">api.llm.complete</code>.
          Each successful call writes a row to <code className="rounded bg-muted px-1 font-mono">LLM_Usage</code> with{' '}
          <code className="rounded bg-muted px-1 font-mono">feature='playground'</code>.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-3 p-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Provider">
              <select
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              >
                <option value={DEFAULT_PROVIDER_VALUE}>
                  Use default
                  {resolvedProvider ? ` (${resolvedProvider.providerName})` : ''}
                </option>
                {providers.map((p) => (
                  <option key={p.providerId} value={String(p.providerId)}>
                    {p.providerName}
                    {p.isDefault === 'Y' ? ' ★' : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Model (optional)">
              <select
                value={modelOverride}
                onChange={(e) => setModelOverride(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              >
                <option value="">Use provider default</option>
                {models.map((m) => (
                  <option key={m.modelId} value={m.modelName}>
                    {m.modelName}
                    {m.providerDefault === 'Y' ? ' ★' : ''}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="System prompt (optional)">
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="e.g. You are a concise assistant."
              rows={2}
              className="w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px]"
            />
          </Field>

          <Field label="User prompt">
            <textarea
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              rows={4}
              className="w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px]"
            />
          </Field>

          <div className="grid grid-cols-3 gap-2">
            <Field label={`Temp ${temperature.toFixed(1)}`}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </Field>
            <Field label="Max tokens">
              <Input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(Math.max(1, Number(e.target.value) || 1))}
                className="h-7 text-xs"
              />
            </Field>
            <Field label="Format">
              <select
                value={responseFormat}
                onChange={(e) => setResponseFormat(e.target.value as 'text' | 'json')}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              >
                <option value="text">text</option>
                <option value="json">json</option>
              </select>
            </Field>
          </div>

          <Button
            onClick={() => sendMutation.mutate()}
            disabled={!canSend}
            className="w-full"
          >
            {sendMutation.isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Send className="mr-1 h-3 w-3" />
            )}
            Send
          </Button>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Recent results (last {history.length})
          </div>
          {history.map(({ ts, result }) => (
            <ResultCard key={ts} ts={ts} result={result} />
          ))}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  )
}

function ResultCard({
  ts,
  result
}: {
  ts: number
  result: LlmCompleteResult
}): JSX.Element {
  return (
    <Card className={cn(!result.ok && 'border-destructive/40')}>
      <CardContent className="space-y-2 p-3">
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          {result.ok ? (
            <Badge variant="success" className="gap-1">
              <Check className="h-3 w-3" /> ok
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <X className="h-3 w-3" /> error
            </Badge>
          )}
          {result.providerName && <Badge variant="outline">{result.providerName}</Badge>}
          {result.model && (
            <Badge variant="outline" className="font-mono">
              {result.model}
            </Badge>
          )}
          {result.usage && (
            <span className="inline-flex items-center gap-0.5 text-muted-foreground">
              <Coins className="h-3 w-3" />
              {result.usage.tokensIn}↓/{result.usage.tokensOut}↑
            </span>
          )}
          {result.latencyMs !== undefined && (
            <span className="inline-flex items-center gap-0.5 text-muted-foreground">
              <Clock className="h-3 w-3" />
              {result.latencyMs}ms
            </span>
          )}
          {result.truncated && (
            <Badge variant="warning" className="gap-1">
              <AlertTriangle className="h-3 w-3" /> truncated
            </Badge>
          )}
          <span className="ml-auto text-muted-foreground">
            {new Date(ts).toLocaleTimeString()}
          </span>
        </div>
        {result.ok ? (
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/40 p-2 font-mono text-[11px]">
            {result.content || '(empty response)'}
          </pre>
        ) : (
          <div className="rounded border border-destructive/30 bg-destructive/10 p-2 font-mono text-[11px] text-destructive">
            {result.error}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Resolve which provider's models should populate the model dropdown.
 * - If user picked a specific provider, use that.
 * - Else, use the one with isDefault='Y'.
 * - Else, undefined (no models shown).
 */
function useResolvedProvider(
  providers: LlmProvider[],
  selected: string
): LlmProvider | undefined {
  return useMemo(() => {
    if (selected !== DEFAULT_PROVIDER_VALUE) {
      return providers.find((p) => String(p.providerId) === selected)
    }
    return providers.find((p) => p.isDefault === 'Y')
  }, [providers, selected])
}

