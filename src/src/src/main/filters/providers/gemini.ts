import type { ClassifiedFilename } from '@shared/types'
import { buildClassifierPrompt, parseClassifierResponse } from '../prompts'
import type { ClassifierAdapter, ClassifierAdapterOpts } from './index'
import { httpJson } from './httpJson'

// Gemini generateContent — https://ai.google.dev/api/generate-content

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
  }>
}

export const geminiAdapter: ClassifierAdapter = {
  provider: 'gemini',
  defaultModel: 'gemini-2.0-flash',
  classify: async ({
    filenames,
    apiKey,
    apiHost,
    model,
    signal
  }: ClassifierAdapterOpts): Promise<ClassifiedFilename[]> => {
    if (!apiKey) throw new Error('Gemini: missing API key')
    const host = apiHost || 'https://generativelanguage.googleapis.com'
    const prompt = buildClassifierPrompt(filenames)

    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json'
      }
    }

    // Use the x-goog-api-key header instead of a ?key= query param so the
    // credential never appears in URLs that might be logged.
    const url = `${host.replace(/\/+$/, '')}/v1beta/models/${encodeURIComponent(model)}:generateContent`
    const res = await httpJson<GeminiResponse>({
      url,
      headers: { 'x-goog-api-key': apiKey },
      body,
      signal
    })

    const text = (res.candidates ?? [])
      .flatMap((c) => c.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('\n')
    return parseClassifierResponse(text, filenames)
  }
}
