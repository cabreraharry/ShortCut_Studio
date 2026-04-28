import type { ChatMessage } from '@shared/types'

/**
 * Inputs handed to a per-provider completion adapter. The dispatcher (in
 * ./index.ts) is responsible for resolving every field — adapters never read
 * the database or the IPC request directly.
 *
 * `messages` is **already system-hoisted**: any role:'system' messages from
 * the original request have been removed and merged into `system`. Adapters
 * for providers that natively support a system role in the messages array
 * (OpenAI, Ollama) should put `system` back at the top of the array before
 * sending; adapters for providers that require a separate top-level field
 * (Claude, Gemini) pass it directly.
 */
export interface CompletionAdapterOpts {
  apiKey: string
  apiHost: string
  model: string
  messages: ChatMessage[]
  /** Hoisted system content (or null). Per-adapter handles re-attachment. */
  system: string | null
  temperature: number
  maxTokens: number
  responseFormat: 'text' | 'json'
  signal?: AbortSignal
}

export interface CompletionAdapterResult {
  content: string
  tokensIn: number
  tokensOut: number
  /** True when the provider clipped output (max_tokens hit, length finish_reason). */
  truncated: boolean
}

export interface CompletionAdapter {
  /** Hardcoded fallback when no model is selected and no override given. */
  defaultModel: string
  complete(opts: CompletionAdapterOpts): Promise<CompletionAdapterResult>
}
