import type { ClassifierProvider } from '@shared/types'

/**
 * Reverse mapping from the user-facing Provider_Name (as stored in
 * LLM_Provider.Provider_Name and shown in the UI) to the internal
 * ClassifierProvider code used by adapters.
 *
 * Both the classifier (filters/classifier.ts) and the completion module
 * (llm/completion/index.ts) look up provider rows by name, so this lives in a
 * shared place. Mock + clipboard providers don't appear here — those aren't
 * stored in the LLM_Provider table.
 */
export const PROVIDER_NAME_BY_CODE: Record<string, ClassifierProvider> = {
  Claude: 'claude',
  OpenAI: 'openai',
  Gemini: 'gemini',
  Ollama: 'ollama'
}

export function providerCodeFromName(name: string): ClassifierProvider | null {
  return PROVIDER_NAME_BY_CODE[name] ?? null
}
