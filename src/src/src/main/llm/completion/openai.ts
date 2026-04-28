import { httpJson } from '../../filters/providers/httpJson'
import type { CompletionAdapter, CompletionAdapterOpts, CompletionAdapterResult } from './types'

// OpenAI Chat Completions — https://platform.openai.com/docs/api-reference/chat
//
// Native role:'system' support: yes; we put the hoisted system content back at
// the top of the messages array.

interface OpenAIResponse {
  choices?: Array<{
    message?: { content?: string }
    finish_reason?: string
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
  }
}

/**
 * Reasoning-family models (o1, o3, o4, future numbered o-series, plus the
 * `chatgpt-*` lineage) reject `temperature` and require `max_completion_tokens`
 * instead of `max_tokens`. OpenAI hasn't given us a capabilities endpoint, so
 * we feature-detect by name prefix. The hyphen after `o\d+` keeps us from
 * matching `omni-*` or other accidental `o`-prefix names.
 */
function isReasoningModel(model: string): boolean {
  return /^(o\d+(-|$)|chatgpt-)/i.test(model)
}

export const openaiAdapter: CompletionAdapter = {
  defaultModel: 'gpt-4o-mini',
  async complete(opts: CompletionAdapterOpts): Promise<CompletionAdapterResult> {
    if (!opts.apiKey) throw new Error('OpenAI: missing API key')
    const host = (opts.apiHost || 'https://api.openai.com').replace(/\/+$/, '')

    const messages = opts.system
      ? [{ role: 'system' as const, content: opts.system }, ...opts.messages]
      : opts.messages

    const reasoning = isReasoningModel(opts.model)
    const body: Record<string, unknown> = {
      model: opts.model,
      messages
    }
    if (reasoning) {
      // Reasoning models reject temperature and use a different token-cap field.
      body.max_completion_tokens = opts.maxTokens
    } else {
      body.temperature = opts.temperature
      body.max_tokens = opts.maxTokens
    }
    if (opts.responseFormat === 'json') {
      body.response_format = { type: 'json_object' }
    }

    const res = await httpJson<OpenAIResponse>({
      url: `${host}/v1/chat/completions`,
      headers: { Authorization: `Bearer ${opts.apiKey}` },
      body,
      signal: opts.signal
    })

    const choice = res.choices?.[0]
    return {
      content: choice?.message?.content ?? '',
      tokensIn: res.usage?.prompt_tokens ?? 0,
      tokensOut: res.usage?.completion_tokens ?? 0,
      truncated: choice?.finish_reason === 'length'
    }
  }
}
