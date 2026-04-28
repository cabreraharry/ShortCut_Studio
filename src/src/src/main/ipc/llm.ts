import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import { getLocAdmDb } from '../db/connection'
import { AuthFailedError, discoverModels } from '../llm/modelDiscovery'
import { complete } from '../llm/completion'
import type {
  LlmCompleteRequest,
  LlmCompleteResult,
  LlmDiscoverResult,
  LlmModel,
  LlmProvider,
  LlmTestResult
} from '@shared/types'

interface ProviderDbRow {
  Provider_ID: number
  Provider_Name: string
  Has_API_Key: 'Y' | 'N'
  API_Key: string
  API_Host: string
  IsDefault: 'Y' | 'N'
  Supported: 'Y' | 'N'
  AllowAddModel: 'Y' | 'N'
}

interface ModelDbRow {
  ModelID: number
  ProviderID: number
  ModelName: string
  ProviderDefault: 'Y' | 'N'
}

function toProvider(r: ProviderDbRow): LlmProvider {
  return {
    providerId: r.Provider_ID,
    providerName: r.Provider_Name,
    hasApiKey: r.Has_API_Key,
    apiKey: r.API_Key,
    apiHost: r.API_Host,
    isDefault: r.IsDefault,
    supported: r.Supported,
    allowAddModel: r.AllowAddModel
  }
}

function toModel(r: ModelDbRow): LlmModel {
  return {
    modelId: r.ModelID,
    providerId: r.ProviderID,
    modelName: r.ModelName,
    providerDefault: r.ProviderDefault
  }
}

export function registerLlmHandlers(): void {
  ipcMain.handle(IpcChannel.LlmListProviders, (): LlmProvider[] => {
    const rows = getLocAdmDb()
      .prepare('SELECT * FROM LLM_Provider ORDER BY Provider_ID')
      .all() as ProviderDbRow[]
    return rows.map(toProvider)
  })

  ipcMain.handle(IpcChannel.LlmUpdateKey, (_evt, providerId: number, key: string) => {
    getLocAdmDb()
      .prepare(
        "UPDATE LLM_Provider SET API_Key = ?, Has_API_Key = CASE WHEN ? = '' THEN 'N' ELSE 'Y' END WHERE Provider_ID = ?"
      )
      .run(key, key, providerId)
  })

  ipcMain.handle(IpcChannel.LlmListModels, (_evt, providerId: number): LlmModel[] => {
    const rows = getLocAdmDb()
      .prepare('SELECT * FROM Models WHERE ProviderID = ? ORDER BY ModelName')
      .all(providerId) as ModelDbRow[]
    return rows.map(toModel)
  })

  ipcMain.handle(IpcChannel.LlmAddModel, (_evt, providerId: number, name: string): LlmModel => {
    const db = getLocAdmDb()
    const info = db
      .prepare(
        "INSERT INTO Models (ProviderID, ModelName, ProviderDefault) VALUES (?, ?, 'N')"
      )
      .run(providerId, name)
    return {
      modelId: Number(info.lastInsertRowid),
      providerId,
      modelName: name,
      providerDefault: 'N'
    }
  })

  ipcMain.handle(IpcChannel.LlmSetDefaultModel, (_evt, modelId: number) => {
    const db = getLocAdmDb()
    const row = db
      .prepare('SELECT ProviderID FROM Models WHERE ModelID = ?')
      .get(modelId) as { ProviderID: number } | undefined
    if (!row) return
    db.transaction(() => {
      db.prepare(
        "UPDATE Models SET ProviderDefault = 'N' WHERE ProviderID = ?"
      ).run(row.ProviderID)
      db.prepare("UPDATE Models SET ProviderDefault = 'Y' WHERE ModelID = ?").run(
        modelId
      )
    })()
  })

  ipcMain.handle(
    IpcChannel.LlmDiscoverModels,
    async (_evt, providerId: number): Promise<LlmDiscoverResult> => {
      const db = getLocAdmDb()
      const provider = db
        .prepare('SELECT * FROM LLM_Provider WHERE Provider_ID = ?')
        .get(providerId) as ProviderDbRow | undefined
      if (!provider) return { ok: false, error: 'Provider not found' }
      const start = Date.now()
      try {
        const result = await discoverModels({
          providerName: provider.Provider_Name,
          apiHost: provider.API_Host,
          apiKey: provider.API_Key
        })
        const latencyMs = Date.now() - start
        // Refuse to wipe the existing list if the discovery returned zero
        // results — that's almost always a transient API/account quirk
        // (e.g. OpenAI returning an empty data array for a fresh org), not a
        // signal that the user should lose their previously curated models.
        if (result.models.length === 0) {
          return {
            ok: false,
            latencyMs,
            error:
              'Provider returned no models — leaving the existing list untouched. Try again or add models manually.'
          }
        }
        // Replace the provider's Models rows transactionally. Preserve the
        // existing default-model name if the user already chose one and the
        // newly discovered list still contains it; otherwise fall back to the
        // discoverer's suggested default (or first model).
        const prevDefault = db
          .prepare(
            "SELECT ModelName FROM Models WHERE ProviderID = ? AND ProviderDefault = 'Y' LIMIT 1"
          )
          .get(providerId) as { ModelName: string } | undefined
        const defaultName =
          (prevDefault && result.models.includes(prevDefault.ModelName)
            ? prevDefault.ModelName
            : result.defaultModel) ?? result.models[0]
        const insertOne = db.prepare(
          'INSERT INTO Models (ProviderID, ModelName, ProviderDefault) VALUES (?, ?, ?)'
        )
        db.transaction(() => {
          db.prepare('DELETE FROM Models WHERE ProviderID = ?').run(providerId)
          for (const name of result.models) {
            insertOne.run(providerId, name, name === defaultName ? 'Y' : 'N')
          }
        })()
        return {
          ok: true,
          latencyMs,
          count: result.models.length,
          models: result.models,
          fallback: result.fallback
        }
      } catch (err) {
        const error =
          err instanceof AuthFailedError
            ? 'Auth failed — check the API key'
            : err instanceof Error
              ? err.message
              : String(err)
        return { ok: false, error, latencyMs: Date.now() - start }
      }
    }
  )

  // Test-connection is just discovery with the model list discarded. Auth
  // validity == discovery success.
  ipcMain.handle(
    IpcChannel.LlmTestConnection,
    async (_evt, providerId: number): Promise<LlmTestResult> => {
      const provider = getLocAdmDb()
        .prepare('SELECT * FROM LLM_Provider WHERE Provider_ID = ?')
        .get(providerId) as ProviderDbRow | undefined
      if (!provider) return { ok: false, error: 'Provider not found' }
      const start = Date.now()
      try {
        await discoverModels({
          providerName: provider.Provider_Name,
          apiHost: provider.API_Host,
          apiKey: provider.API_Key
        })
        return { ok: true, latencyMs: Date.now() - start }
      } catch (err) {
        const error =
          err instanceof AuthFailedError
            ? 'Auth failed — check the API key'
            : err instanceof Error
              ? err.message
              : String(err)
        return { ok: false, error, latencyMs: Date.now() - start }
      }
    }
  )

  // Generic chat-completion entry point. Routes through the configured default
  // provider (or an explicit override) and writes a row to LLM_Usage on success.
  // Any feature in the app can call this via api.llm.complete(req).
  ipcMain.handle(
    IpcChannel.LlmComplete,
    async (_evt, req: LlmCompleteRequest): Promise<LlmCompleteResult> => {
      return complete(req)
    }
  )
}
