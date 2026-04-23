import type { ClassifiedFilename } from '@shared/types'
import { buildClassifierPrompt, parseClassifierResponse } from '../prompts'
import type { ClassifierAdapter, ClassifierAdapterOpts } from './index'
import { httpJson } from './httpJson'

// Ollama local HTTP API — https://github.com/ollama/ollama/blob/main/docs/api.md

interface OllamaChatResponse {
  message?: { content?: string }
}

export const ollamaAdapter: ClassifierAdapter = {
  provider: 'ollama',
  defaultModel: 'llama3.2',
  classify: async ({
    filenames,
    apiHost,
    model,
    signal
  }: ClassifierAdapterOpts): Promise<ClassifiedFilename[]> => {
    const host = apiHost || 'http://localhost:11434'
    const prompt = buildClassifierPrompt(filenames)

    const body = {
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      format: 'json',
      options: { temperature: 0 }
    }

    const res = await httpJson<OllamaChatResponse>({
      url: `${host.replace(/\/+$/, '')}/api/chat`,
      body,
      signal
    })

    let text = res.message?.content ?? ''
    // Ollama's `format: 'json'` returns a bare object; parseClassifierResponse
    // expects an array. If it's an object with a single array property, unwrap.
    try {
      const parsed: unknown = JSON.parse(text)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const maybeArr = Object.values(parsed).find((v) => Array.isArray(v))
        if (maybeArr) text = JSON.stringify(maybeArr)
      }
    } catch {
      // parser is tolerant, let it try
    }
    return parseClassifierResponse(text, filenames)
  }
}
