import type {
  ChatMessage,
  ClassifierProvider,
  LlmCompleteRequest,
  LlmCompleteResult
} from '@shared/types'
import { getLocAdmDb } from '../../db/connection'
import { recordError } from '../../diagnostics/errorStore'
import { providerCodeFromName } from '../providerName'
import { claudeAdapter } from './claude'
import { geminiAdapter } from './gemini'
import { ollamaAdapter } from './ollama'
import { openaiAdapter } from './openai'
import type { CompletionAdapter } from './types'

const ADAPTERS: Partial<Record<ClassifierProvider, CompletionAdapter>> = {
  claude: claudeAdapter,
  openai: openaiAdapter,
  gemini: geminiAdapter,
  ollama: ollamaAdapter
}

interface ProviderRow {
  Provider_ID: number
  Provider_Name: string
  API_Key: string
  API_Host: string
  IsDefault: 'Y' | 'N'
}

/**
 * Pull a system message out of the messages array. Multiple system messages
 * are merged with `\n\n`; subsequent appearances after non-system messages are
 * also merged (we don't try to enforce ordering — callers can if they need to).
 *
 * Returns the rest of the messages with all role:'system' removed. If no
 * system messages exist, returns `system: null` and `rest: messages` unchanged.
 */
export function hoistSystemMessage(
  messages: ChatMessage[]
): { system: string | null; rest: ChatMessage[] } {
  const systems: string[] = []
  const rest: ChatMessage[] = []
  let sawSystem = false
  for (const m of messages) {
    if (m.role === 'system') {
      // Preserve empty content explicitly — a caller passing an empty system
      // message is meaningfully different from passing none at all (e.g.
      // overriding a default system prompt with "no instruction").
      sawSystem = true
      systems.push(m.content)
    } else {
      rest.push(m)
    }
  }
  return {
    system: sawSystem ? systems.join('\n\n') : null,
    rest
  }
}

function loadProviderRow(providerId?: number): ProviderRow | null {
  const db = getLocAdmDb()
  if (providerId !== undefined) {
    const row = db
      .prepare(
        'SELECT Provider_ID, Provider_Name, API_Key, API_Host, IsDefault FROM LLM_Provider WHERE Provider_ID = ?'
      )
      .get(providerId) as ProviderRow | undefined
    return row ?? null
  }
  const row = db
    .prepare(
      "SELECT Provider_ID, Provider_Name, API_Key, API_Host, IsDefault FROM LLM_Provider WHERE IsDefault = 'Y' LIMIT 1"
    )
    .get() as ProviderRow | undefined
  return row ?? null
}

interface ResolvedModel {
  modelName: string
  modelId: number | null
}

function resolveModel(
  providerId: number,
  override: string | undefined,
  adapterDefault: string
): ResolvedModel {
  const db = getLocAdmDb()
  if (override) {
    // Look up modelId for this name + provider so the LLM_Usage row can carry
    // a foreign key. Missing rows are fine; we still call with the name.
    const row = db
      .prepare(
        'SELECT ModelID FROM Models WHERE ProviderID = ? AND ModelName = ? LIMIT 1'
      )
      .get(providerId, override) as { ModelID: number } | undefined
    return { modelName: override, modelId: row?.ModelID ?? null }
  }
  const def = db
    .prepare(
      "SELECT ModelID, ModelName FROM Models WHERE ProviderID = ? AND ProviderDefault = 'Y' LIMIT 1"
    )
    .get(providerId) as { ModelID: number; ModelName: string } | undefined
  if (def) return { modelName: def.ModelName, modelId: def.ModelID }
  // Final fallback: the adapter's hardcoded default. No DB row to link to.
  return { modelName: adapterDefault, modelId: null }
}

interface UsageLog {
  providerId: number
  modelId: number | null
  feature: string | null
  tokensIn: number
  tokensOut: number
  latencyMs: number
}

function logUsage(u: UsageLog): void {
  const db = getLocAdmDb()
  db.prepare(
    `INSERT INTO LLM_Usage (providerId, tokensIn, tokensOut, ts, modelId, feature, latencyMs)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    u.providerId,
    u.tokensIn,
    u.tokensOut,
    Math.floor(Date.now() / 1000),
    u.modelId,
    u.feature,
    u.latencyMs
  )
}

/**
 * IPC-boundary input validation. TypeScript types apply at compile time only —
 * a malformed renderer payload (e.g. `messages: null`) would otherwise crash
 * the dispatcher inside `hoistSystemMessage`'s `for...of` loop and bubble as
 * an unhandled IPC rejection. Returning a typed error result keeps the
 * contract well-formed.
 */
function validateRequest(req: LlmCompleteRequest): string | null {
  if (!req || typeof req !== 'object') return 'Invalid request: expected object'
  if (!Array.isArray(req.messages)) return 'Invalid request: messages must be an array'
  if (req.messages.length === 0) return 'Invalid request: messages array is empty'
  for (let i = 0; i < req.messages.length; i++) {
    const m = req.messages[i] as ChatMessage | null | undefined
    if (!m || typeof m !== 'object') return `Invalid message at index ${i}`
    if (m.role !== 'system' && m.role !== 'user' && m.role !== 'assistant') {
      return `Invalid role at index ${i}: ${String(m.role)}`
    }
    if (typeof m.content !== 'string') {
      return `Invalid content at index ${i}: must be string`
    }
  }
  return null
}

export async function complete(req: LlmCompleteRequest): Promise<LlmCompleteResult> {
  const start = Date.now()

  // 0. Validate the IPC payload shape. Renderer-side TS doesn't protect us
  // from a misbehaving / compromised renderer.
  const validationError = validateRequest(req)
  if (validationError) {
    return { ok: false, error: validationError, latencyMs: 0 }
  }

  // Outer try/catch: any unexpected throw (DB error, adapter exception, etc.)
  // becomes a typed error result instead of an unhandled IPC rejection.
  try {
    // 1. Resolve provider.
    const providerRow = loadProviderRow(req.providerId)
    if (!providerRow) {
      return {
        ok: false,
        error:
          req.providerId !== undefined
            ? `Provider ${req.providerId} not found`
            : 'No default provider configured — set one on the LLMs page',
        latencyMs: Date.now() - start
      }
    }
    const code = providerCodeFromName(providerRow.Provider_Name)
    if (!code) {
      return {
        ok: false,
        error: `Unknown provider: ${providerRow.Provider_Name}`,
        latencyMs: Date.now() - start
      }
    }
    const adapter = ADAPTERS[code]
    if (!adapter) {
      return {
        ok: false,
        error: `No completion adapter for provider: ${providerRow.Provider_Name}`,
        latencyMs: Date.now() - start
      }
    }
    // Ollama is the only provider that doesn't need an API key. The adapters
    // also re-check this internally as defense-in-depth — if the dispatcher
    // guard is ever loosened for a provider, the adapter's own check still
    // produces a meaningful error.
    if (code !== 'ollama' && !providerRow.API_Key) {
      return {
        ok: false,
        error: `${providerRow.Provider_Name} has no API key configured`,
        latencyMs: Date.now() - start
      }
    }

    // 2. Resolve model.
    const { modelName, modelId } = resolveModel(
      providerRow.Provider_ID,
      req.modelName,
      adapter.defaultModel
    )

    // 3. Hoist system message.
    const { system, rest } = hoistSystemMessage(req.messages)

    // 4. Call adapter.
    const result = await adapter.complete({
      apiKey: providerRow.API_Key,
      apiHost: providerRow.API_Host,
      model: modelName,
      messages: rest,
      system,
      temperature: req.temperature ?? 0.2,
      maxTokens: req.maxTokens ?? 1024,
      responseFormat: req.responseFormat ?? 'text'
    })
    const latencyMs = Date.now() - start

    // 5. Log usage.
    logUsage({
      providerId: providerRow.Provider_ID,
      modelId,
      feature: req.feature ?? null,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      latencyMs
    })

    return {
      ok: true,
      content: result.content,
      model: modelName,
      providerName: providerRow.Provider_Name,
      latencyMs,
      usage: { tokensIn: result.tokensIn, tokensOut: result.tokensOut },
      truncated: result.truncated
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    recordError({
      source: 'llm',
      severity: 'error',
      category: req.feature ?? 'complete',
      message,
      stack: err instanceof Error ? err.stack : undefined,
      context: {
        providerId: req.providerId ?? null,
        modelName: req.modelName ?? null,
        feature: req.feature ?? null
      }
    })
    return {
      ok: false,
      error: message,
      latencyMs: Date.now() - start
    }
  }
}
