import type { ClassifiedFilename } from '@shared/types'
import { buildClassifierPrompt, parseClassifierResponse } from '../prompts'
import type { ClassifierAdapter, ClassifierAdapterOpts } from './index'
import { httpJson } from './httpJson'

// Claude Messages API — https://docs.anthropic.com/en/api/messages
// Pinned to v1 via `anthropic-version` header.

interface ClaudeResponse {
  content?: Array<{ type: string; text?: string }>
}

export const claudeAdapter: ClassifierAdapter = {
  provider: 'claude',
  defaultModel: 'claude-sonnet-4-5',
  classify: async ({
    filenames,
    apiKey,
    apiHost,
    model,
    signal
  }: ClassifierAdapterOpts): Promise<ClassifiedFilename[]> => {
    if (!apiKey) throw new Error('Claude: missing API key')
    const host = apiHost || 'https://api.anthropic.com'
    const prompt = buildClassifierPrompt(filenames)

    const body = {
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    }

    const res = await httpJson<ClaudeResponse>({
      url: `${host.replace(/\/+$/, '')}/v1/messages`,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body,
      signal
    })

    const text =
      (res.content ?? [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text ?? '')
        .join('\n') ?? ''
    return parseClassifierResponse(text, filenames)
  }
}
