import { httpJson } from '../../filters/providers/httpJson'
import type { CompletionAdapter, CompletionAdapterOpts, CompletionAdapterResult } from './types'

// LM Studio — https://lmstudio.ai/docs/local-server
//
// LM Studio runs an OpenAI-compatible local server on http://localhost:1234/v1
// by default. No auth required (local-only). The active loaded model is
// reported by /v1/models; opts.model is passed through but LM Studio will
// route to whichever model is currently loaded if it doesn't match exactly.

interface LmResponse {
  choices?: Array<{
    message?: { content?: string }
    finish_reason?: string
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
  }
}

export const lmStudioAdapter: CompletionAdapter = {
  defaultModel: 'local-model',
  async complete(opts: CompletionAdapterOpts): Promise<CompletionAdapterResult> {
    const host = (opts.apiHost || 'http://localhost:1234/v1').replace(/\/+$/, '')

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

    let res: LmResponse
    try {
      res = await httpJson<LmResponse>({
        url: `${host}/chat/completions`,
        body,
        signal: opts.signal
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i.test(msg)) {
        throw new Error(
          `LM Studio unreachable — is the local server running on ${host}? (${msg})`
        )
      }
      throw err
    }

    const choice = res.choices?.[0]
    return {
      content: choice?.message?.content ?? '',
      tokensIn: res.usage?.prompt_tokens ?? 0,
      tokensOut: res.usage?.completion_tokens ?? 0,
      truncated: choice?.finish_reason === 'length'
    }
  }
}
