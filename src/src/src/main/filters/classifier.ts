import { BrowserWindow } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import type {
  ClassifiedFilename,
  ClassifyFileInput,
  ClassifyProgress,
  ClassifyRequest,
  ClassifierProvider
} from '@shared/types'
import { getLocAdmDb } from '../db/connection'
import type { ClassifierAdapter } from './providers'
import { claudeAdapter } from './providers/claude'
import { openaiAdapter } from './providers/openai'
import { geminiAdapter } from './providers/gemini'
import { ollamaAdapter } from './providers/ollama'
import { mockAdapter } from './providers/mock'
import { clipboardAdapter } from './providers/clipboard'

const ADAPTERS: Record<ClassifierProvider, ClassifierAdapter> = {
  claude: claudeAdapter,
  openai: openaiAdapter,
  gemini: geminiAdapter,
  ollama: ollamaAdapter,
  mock: mockAdapter,
  clipboard: clipboardAdapter
}

interface ProviderConfig {
  apiKey: string
  apiHost: string
}

const PROVIDER_NAME_BY_CODE: Record<string, ClassifierProvider> = {
  Claude: 'claude',
  OpenAI: 'openai',
  Gemini: 'gemini',
  Ollama: 'ollama'
}

function loadProviderConfig(provider: ClassifierProvider): ProviderConfig {
  if (provider === 'mock' || provider === 'clipboard') {
    return { apiKey: '', apiHost: '' }
  }
  const db = getLocAdmDb()
  // Find a provider row whose Provider_Name maps to this code.
  const wantedName = Object.entries(PROVIDER_NAME_BY_CODE).find(([, v]) => v === provider)?.[0]
  if (!wantedName) return { apiKey: '', apiHost: '' }
  const row = db
    .prepare('SELECT API_Key, API_Host FROM LLM_Provider WHERE Provider_Name = ?')
    .get(wantedName) as { API_Key: string; API_Host: string } | undefined
  return { apiKey: row?.API_Key ?? '', apiHost: row?.API_Host ?? '' }
}

function upsertLabels(labels: ClassifiedFilename[], model: string): void {
  if (labels.length === 0) return
  const db = getLocAdmDb()
  const stmt = db.prepare(
    `INSERT INTO FileAiLabels (fileId, label, confidence, model, classifiedAt, reason)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(fileId) DO UPDATE SET
       label = excluded.label,
       confidence = excluded.confidence,
       model = excluded.model,
       classifiedAt = excluded.classifiedAt,
       reason = excluded.reason`
  )
  const ts = Date.now()
  const tx = db.transaction((rows: ClassifiedFilename[]) => {
    for (const r of rows) {
      stmt.run(r.fileId, r.label, r.confidence, model, ts, r.reason ?? null)
    }
  })
  tx(labels)
}

function emitProgress(p: ClassifyProgress): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send(IpcChannel.FiltersClassifyProgress, p)
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

let jobSeq = 0
function newJobId(): string {
  jobSeq += 1
  return `classify-${Date.now()}-${jobSeq}`
}

export function startClassifyJob(req: ClassifyRequest): { jobId: string } {
  const jobId = newJobId()
  const adapter = ADAPTERS[req.provider]
  if (!adapter) {
    emitProgress({
      jobId,
      phase: 'error',
      completed: 0,
      total: req.filenames.length,
      error: `unknown provider: ${req.provider}`
    })
    return { jobId }
  }

  // Clipboard provider goes through a different flow — reject here.
  if (req.provider === 'clipboard') {
    emitProgress({
      jobId,
      phase: 'error',
      completed: 0,
      total: req.filenames.length,
      error: 'Use clipboard prompt/apply IPC for the clipboard provider'
    })
    return { jobId }
  }

  void runJob(jobId, req, adapter)
  return { jobId }
}

async function runJob(
  jobId: string,
  req: ClassifyRequest,
  adapter: ClassifierAdapter
): Promise<void> {
  const batchSize = Math.max(1, Math.min(500, req.batchSize ?? 200))
  const model = req.model ?? adapter.defaultModel
  const { apiKey, apiHost } = loadProviderConfig(req.provider)
  const batches = chunk<ClassifyFileInput>(req.filenames, batchSize)
  const total = req.filenames.length
  const modelKey = `${req.provider}:${model}`

  emitProgress({ jobId, phase: 'queued', completed: 0, total })

  let completed = 0
  let failedBatches = 0
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    emitProgress({
      jobId,
      phase: 'running',
      completed,
      total,
      currentBatch: i + 1,
      failedBatches
    })
    try {
      const results = await adapter.classify({
        filenames: batch,
        apiKey,
        apiHost,
        model
      })
      upsertLabels(results, modelKey)
      completed += batch.length
    } catch (err) {
      failedBatches += 1
      // `completed` counts successfully-labeled files only, so the final toast
      // can honestly report "Classified N of M" with N < M on partial failure.
      // eslint-disable-next-line no-console
      console.error(`[classifier] batch ${i + 1} failed:`, err)
    }
  }

  emitProgress({
    jobId,
    phase: 'done',
    completed,
    total,
    failedBatches
  })
}
