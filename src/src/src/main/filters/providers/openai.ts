import type { ClassifiedFilename } from '@shared/types'
import { buildClassifierPrompt, parseClassifierResponse } from '../prompts'
import type { ClassifierAdapter, ClassifierAdapterOpts } from './index'
import { httpJson } from './httpJson'

// OpenAI Chat Completions — https://platform.openai.com/docs/api-reference/chat

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string } }>
}

export const openaiAdapter: ClassifierAdapter = {
  provider: 'openai',
  defaultModel: 'gpt-4o-mini',
  classify: async ({
    filenames,
    apiKey,
    apiHost,
    model,
    signal
  }: ClassifierAdapterOpts): Promise<ClassifiedFilename[]> => {
    if (!apiKey) throw new Error('OpenAI: missing API key')
    const host = apiHost || 'https://api.openai.com'
    const prompt = buildClassifierPrompt(filenames)

    const body = {
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      response_format: { type: 'json_object' }
    }

    const res = await httpJson<OpenAIResponse>({
      url: `${host.replace(/\/+$/, '')}/v1/chat/completions`,
      headers: { Authorization: `Bearer ${apiKey}` },
      body,
      signal
    })

    const text = res.choices?.[0]?.message?.content ?? ''
    // With response_format=json_object, OpenAI returns a wrapped object like
    // {"results": [...]}. Accept that shape or a bare array. parseClassifierResponse
    // already handles bare arrays and tolerates extra whitespace/fencing.
    // If the response is a wrapped object, unwrap it before passing in.
    let forParse = text
    try {
      const parsed: unknown = JSON.parse(text)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const maybeArr = Object.values(parsed).find((v) => Array.isArray(v))
        if (maybeArr) forParse = JSON.stringify(maybeArr)
      }
    } catch {
      // fall through, parser is tolerant
    }
    return parseClassifierResponse(forParse, filenames)
  }
}
