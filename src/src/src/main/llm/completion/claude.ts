import { httpJson } from '../../filters/providers/httpJson'
import type { CompletionAdapter, CompletionAdapterOpts, CompletionAdapterResult } from './types'

// Anthropic Messages API — https://docs.anthropic.com/en/api/messages
//
// Required: `anthropic-version: 2023-06-01` (or newer) header. The top-level
// `system` parameter is supported in this version.

interface ClaudeResponse {
  content?: Array<{ type: string; text?: string }>
  stop_reason?: string
  usage?: {
    input_tokens?: number
    output_tokens?: number
  }
}

export const claudeAdapter: CompletionAdapter = {
  defaultModel: 'claude-sonnet-4-5',
  async complete(opts: CompletionAdapterOpts): Promise<CompletionAdapterResult> {
    if (!opts.apiKey) throw new Error('Claude: missing API key')
    const host = (opts.apiHost || 'https://api.anthropic.com').replace(/\/+$/, '')

    const body: Record<string, unknown> = {
      model: opts.model,
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
      messages: opts.messages.map((m) => ({ role: m.role, content: m.content }))
    }
    if (opts.system) body.system = opts.system
    // Anthropic doesn't have a structured-output mode equivalent to OpenAI's
    // response_format. Callers asking for JSON should put 'Reply ONLY with a
    // JSON object' into the system message themselves — we don't bend the
    // request shape here.

    const res = await httpJson<ClaudeResponse>({
      url: `${host}/v1/messages`,
      headers: {
        'x-api-key': opts.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body,
      signal: opts.signal
    })

    // Concatenate every text block. Empty content arrays are valid (e.g. a
    // zero-token response) — return '' rather than erroring.
    const content = (res.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('\n')

    return {
      content,
      tokensIn: res.usage?.input_tokens ?? 0,
      tokensOut: res.usage?.output_tokens ?? 0,
      truncated: res.stop_reason === 'max_tokens'
    }
  }
}
