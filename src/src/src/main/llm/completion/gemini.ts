import { httpJson } from '../../filters/providers/httpJson'
import type { CompletionAdapter, CompletionAdapterOpts, CompletionAdapterResult } from './types'

// Gemini generateContent — https://ai.google.dev/api/generate-content
//
// Quirks vs. OpenAI / Claude:
// - 'assistant' role is called 'model' here.
// - role:'system' is rejected anywhere in `contents[]`; system must go into a
//   top-level `systemInstruction` field. The dispatcher already hoists it for us.
// - `responseMimeType: 'application/json'` is supported on Gemini 1.5+ / 2.0+
//   only — older models throw. Set it ONLY when the caller explicitly asks for
//   JSON; let the model error propagate if they're on an old model.

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
    finishReason?: string
  }>
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
  }
}

function geminiRole(role: 'user' | 'assistant'): 'user' | 'model' {
  return role === 'assistant' ? 'model' : 'user'
}

export const geminiAdapter: CompletionAdapter = {
  defaultModel: 'gemini-2.0-flash',
  async complete(opts: CompletionAdapterOpts): Promise<CompletionAdapterResult> {
    if (!opts.apiKey) throw new Error('Gemini: missing API key')
    const host = (opts.apiHost || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '')

    // Defensive: hoister already removed system, but if a stray one slips
    // through we'd get a 400 from Gemini — drop them here too.
    const contents = opts.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: geminiRole(m.role as 'user' | 'assistant'),
        parts: [{ text: m.content }]
      }))

    const generationConfig: Record<string, unknown> = {
      temperature: opts.temperature,
      maxOutputTokens: opts.maxTokens
    }
    if (opts.responseFormat === 'json') {
      generationConfig.responseMimeType = 'application/json'
    }

    const body: Record<string, unknown> = { contents, generationConfig }
    if (opts.system) {
      body.systemInstruction = { parts: [{ text: opts.system }] }
    }

    // Use the x-goog-api-key header (mirrors filters/providers/gemini.ts) so
    // the credential never lands in URL strings that might get logged.
    const url = `${host}/v1beta/models/${encodeURIComponent(opts.model)}:generateContent`
    const res = await httpJson<GeminiResponse>({
      url,
      headers: { 'x-goog-api-key': opts.apiKey },
      body,
      signal: opts.signal
    })

    const candidate = res.candidates?.[0]
    const content = (candidate?.content?.parts ?? []).map((p) => p.text ?? '').join('\n')

    return {
      content,
      tokensIn: res.usageMetadata?.promptTokenCount ?? 0,
      tokensOut: res.usageMetadata?.candidatesTokenCount ?? 0,
      truncated: candidate?.finishReason === 'MAX_TOKENS'
    }
  }
}
