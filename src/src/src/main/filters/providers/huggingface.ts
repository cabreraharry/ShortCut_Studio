import type { ClassifiedFilename } from '@shared/types'
import { buildClassifierPrompt, parseClassifierResponse } from '../prompts'
import type { ClassifierAdapter, ClassifierAdapterOpts } from './index'
import { httpJson } from './httpJson'

// Hugging Face Inference Providers — OpenAI-compatible chat-completions at
// https://router.huggingface.co/v1. Auth via Bearer token.

interface HfResponse {
  choices?: Array<{ message?: { content?: string } }>
}

export const huggingfaceAdapter: ClassifierAdapter = {
  provider: 'huggingface',
  defaultModel: 'meta-llama/Llama-3.3-70B-Instruct',
  classify: async ({
    filenames,
    apiKey,
    apiHost,
    model,
    signal
  }: ClassifierAdapterOpts): Promise<ClassifiedFilename[]> => {
    if (!apiKey) throw new Error('HuggingFace: missing API token')
    const host = (apiHost || 'https://router.huggingface.co/v1').replace(/\/+$/, '')
    const prompt = buildClassifierPrompt(filenames)

    const body = {
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      response_format: { type: 'json_object' }
    }

    const res = await httpJson<HfResponse>({
      url: `${host}/chat/completions`,
      headers: { Authorization: `Bearer ${apiKey}` },
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
      // parser is tolerant of unwrapped text
    }
    return parseClassifierResponse(forParse, filenames)
  }
}
