import { httpJson } from '../../filters/providers/httpJson'
import type { CompletionAdapter, CompletionAdapterOpts, CompletionAdapterResult } from './types'

// Ollama chat — https://github.com/ollama/ollama/blob/main/docs/api.md
//
// Native role:'system' support: yes. Re-attach the hoisted system message at
// the top of the messages array.

interface OllamaResponse {
  message?: { content?: string }
  done?: boolean
  done_reason?: string
  prompt_eval_count?: number
  eval_count?: number
}

export const ollamaAdapter: CompletionAdapter = {
  defaultModel: 'llama3.2',
  async complete(opts: CompletionAdapterOpts): Promise<CompletionAdapterResult> {
    const host = (opts.apiHost || 'http://localhost:11434').replace(/\/+$/, '')

    const messages = opts.system
      ? [{ role: 'system' as const, content: opts.system }, ...opts.messages]
      : opts.messages

    const body: Record<string, unknown> = {
      model: opts.model,
      messages,
      stream: false,
      options: {
        temperature: opts.temperature,
        num_predict: opts.maxTokens
      }
    }
    if (opts.responseFormat === 'json') {
      body.format = 'json'
    }

    let res: OllamaResponse
    try {
      res = await httpJson<OllamaResponse>({
        url: `${host}/api/chat`,
        body,
        signal: opts.signal
      })
    } catch (err) {
      // Most common failure mode: daemon isn't running. Rewrap as something
      // actionable. `httpJson` uses electron.net.request which surfaces
      // libuv-style errno strings (ECONNREFUSED / ETIMEDOUT / ENOTFOUND), not
      // Chromium's `ERR_CONNECTION_REFUSED` or fetch's `network error`.
      const msg = err instanceof Error ? err.message : String(err)
      if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i.test(msg)) {
        throw new Error(
          `Ollama unreachable — is the daemon running on ${host}? (${msg})`
        )
      }
      throw err
    }

    return {
      content: res.message?.content ?? '',
      // Older Ollama versions omit eval_count; default to 0 so we still log.
      tokensIn: res.prompt_eval_count ?? 0,
      tokensOut: res.eval_count ?? 0,
      truncated: res.done_reason === 'length'
    }
  }
}
