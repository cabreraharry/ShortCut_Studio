import type { ClassifiedFilename } from '@shared/types'
import { buildClassifierPrompt, parseClassifierResponse } from '../prompts'
import type { ClassifierAdapter, ClassifierAdapterOpts } from './index'
import { httpJson } from './httpJson'

// LM Studio — OpenAI-compatible local server on http://localhost:1234/v1.
// No auth required (local-only).

interface LmResponse {
  choices?: Array<{ message?: { content?: string } }>
}

export const lmStudioAdapter: ClassifierAdapter = {
  provider: 'lmstudio',
  defaultModel: 'local-model',
  classify: async ({
    filenames,
    apiHost,
    model,
    signal
  }: ClassifierAdapterOpts): Promise<ClassifiedFilename[]> => {
    const host = (apiHost || 'http://localhost:1234/v1').replace(/\/+$/, '')
    const prompt = buildClassifierPrompt(filenames)

    const body = {
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      response_format: { type: 'json_object' }
    }

    const res = await httpJson<LmResponse>({
      url: `${host}/chat/completions`,
      body,
      signal
    })

    const text = res.choices?.[0]?.message?.content ?? ''
    let forParse = text
    try {
      const parsed: unknown = JSON.parse(text)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const maybeArr = Object.values(parsed).find((v) => Array.isArray(v))
        if (maybeArr) forParse = JSON.stringify(maybeArr)
      }
    } catch {
      // parser is tolerant
    }
    return parseClassifierResponse(forParse, filenames)
  }
}
