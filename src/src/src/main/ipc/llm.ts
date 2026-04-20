import { ipcMain, net } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import { getLocAdmDb } from '../db/connection'
import type { LlmModel, LlmProvider, LlmTestResult } from '@shared/types'

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
    IpcChannel.LlmTestConnection,
    async (_evt, providerId: number): Promise<LlmTestResult> => {
      const provider = getLocAdmDb()
        .prepare('SELECT * FROM LLM_Provider WHERE Provider_ID = ?')
        .get(providerId) as ProviderDbRow | undefined
      if (!provider) return { ok: false, error: 'Provider not found' }
      const start = Date.now()
      try {
        // Minimal reachability check — depends on provider. For Ollama, GET /api/tags.
        // For OpenAI/Claude/Gemini, just verify we can reach the host root with auth.
        // This is a v1 placeholder; real test-calls land alongside the LLM feature build-out.
        const host = provider.API_Host || ''
        if (!host) return { ok: false, error: 'No API host configured' }
        await new Promise<void>((resolve, reject) => {
          const req = net.request({ method: 'GET', url: host })
          req.on('response', (res) => {
            res.on('data', () => {})
            res.on('end', () => {
              if (res.statusCode && res.statusCode < 500) resolve()
              else reject(new Error(`HTTP ${res.statusCode}`))
            })
          })
          req.on('error', reject)
          req.end()
        })
        return { ok: true, latencyMs: Date.now() - start }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    }
  )
}
