import { httpJson } from '../../filters/providers/httpJson'
import type { CompletionAdapter, CompletionAdapterOpts, CompletionAdapterResult } from './types'

// Hugging Face Inference Providers — https://huggingface.co/docs/inference-providers
//
// The router at https://router.huggingface.co/v1 exposes an OpenAI-compatible
// chat-completions surface. A single HF token covers every model on the
// router; the model name (e.g. `meta-llama/Llama-3.3-70B-Instruct`) selects
// which upstream provider handles the request.
//
// Native role:'system' support: yes (OpenAI wire format) — re-attach the
// hoisted system message at the top of the messages array.

interface HfResponse {
  choices?: Array<{
    message?: { content?: string }
    finish_reason?: string
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
  }
}

export const huggingfaceAdapter: CompletionAdapter = {
  defaultModel: 'meta-llama/Llama-3.3-70B-Instruct',
  async complete(opts: CompletionAdapterOpts): Promise<CompletionAdapterResult> {
    if (!opts.apiKey) throw new Error('HuggingFace: missing API token')
    const host = (opts.apiHost || 'https://router.huggingface.co/v1').replace(/\/+$/, '')

    const messages = opts.system
      ? [{ role: 'system' as const, content: opts.system }, ...opts.messages]
      : opts.messages

    const body: Record<string, unknown> = {
      model: opts.model,
      messages,
      temperature: opts.temperature,
      max_tokens: opts.maxTokens
    }
    if (opts.responseFormat === 'json') {
      body.response_format = { type: 'json_object' }
    }

    const res = await httpJson<HfResponse>({
      url: `${host}/chat/completions`,
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
