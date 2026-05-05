import { ipcMain, net } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import { getLocAdmDb } from '../db/connection'
import { AuthFailedError, discoverModels } from '../llm/modelDiscovery'
import { complete } from '../llm/completion'
import { redactSecrets } from '../security/redact'
import type {
  LlmCompleteRequest,
  LlmCompleteResult,
  LlmDiscoverResult,
  LlmModel,
  LlmOpenAiUsageResult,
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
  // Intentionally omits API_Key — it never leaves the main process. The
  // renderer can only ask "is a key set?" (hasApiKey) and write a new one
  // (LlmUpdateKey channel). Reading the existing value back is not
  // supported by design; the corresponding "Replace key" UX flow lets the
  // user paste a fresh value without ever needing the old one in renderer
  // memory.
  return {
    providerId: r.Provider_ID,
    providerName: r.Provider_Name,
    hasApiKey: r.Has_API_Key,
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

  // OpenAI inline usage fetch — pulls today's USD spend from the
  // undocumented `/v1/usage` endpoint using the user's existing API key.
  // The renderer hides the inline display gracefully on any failure (auth
  // error, endpoint changed shape, network down) so the dashboard-link
  // fallback always remains. UTC date matches OpenAI's billing day boundary.
  ipcMain.handle(
    IpcChannel.LlmFetchOpenAiUsage,
    async (_evt, providerId: number): Promise<LlmOpenAiUsageResult> => {
      const db = getLocAdmDb()
      const provider = db
        .prepare(
          'SELECT Provider_Name, API_Key, API_Host FROM LLM_Provider WHERE Provider_ID = ?'
        )
        .get(providerId) as
        | { Provider_Name: string; API_Key: string; API_Host: string }
        | undefined
      if (!provider) return { ok: false, error: 'Provider not found' }
      if (provider.Provider_Name !== 'OpenAI') {
        return { ok: false, error: 'Usage fetch only supported for OpenAI' }
      }
      if (!provider.API_Key) return { ok: false, error: 'No API key set' }

      // UTC YYYY-MM-DD — OpenAI's billing day boundary.
      const today = new Date()
      const date = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`
      const host = (provider.API_Host || 'https://api.openai.com').replace(/\/+$/, '')

      try {
        const body = await new Promise<string>((resolve, reject) => {
          const req = net.request({
            method: 'GET',
            url: `${host}/v1/usage?date=${date}`
          })
          req.setHeader('Authorization', `Bearer ${provider.API_Key}`)
          const chunks: Buffer[] = []
          req.on('response', (res) => {
            res.on('data', (c) => chunks.push(c as Buffer))
            res.on('end', () => {
              const text = Buffer.concat(chunks).toString('utf8')
              if ((res.statusCode ?? 0) >= 400) {
                // Defensive: some providers echo the request's Authorization
                // header back into 4xx error bodies. redactSecrets strips
                // common API-key shapes before the toast/log captures it.
                reject(new Error(`HTTP ${res.statusCode}: ${redactSecrets(text.slice(0, 200))}`))
                return
              }
              resolve(text)
            })
            res.on('error', reject)
          })
          req.on('error', reject)
          req.end()
        })

        // Tolerant parse: OpenAI's `/v1/usage` shape has shifted across years.
        // Try `total_usage` (cents) first; that's the canonical aggregate when
        // present and a 0 there is a legitimate "no activity today". Only fall
        // back to summing `data[].cost` when the array is non-empty — an empty
        // `data: []` with no `total_usage` field is too ambiguous (could be
        // genuine zero, could be an endpoint shape we don't recognise), so we
        // hide the inline display rather than confidently showing $0.00.
        const parsed = JSON.parse(body) as {
          total_usage?: number
          data?: Array<{ cost?: number }>
        }
        let cents: number | undefined
        if (typeof parsed.total_usage === 'number') {
          cents = parsed.total_usage
        } else if (Array.isArray(parsed.data) && parsed.data.length > 0) {
          cents = parsed.data.reduce(
            (sum, d) => sum + (typeof d.cost === 'number' ? d.cost : 0),
            0
          )
        }
        if (cents === undefined || !Number.isFinite(cents)) {
          return { ok: false, error: 'Unexpected response shape' }
        }
        return { ok: true, usdToday: cents / 100 }
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err)
        }
      }
    }
  )
}
