import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import type {
  AiLabel,
  ClassifiedFilename,
  ClassifyFileInput,
  ClassifyRequest,
  ClipboardPromptResult,
  FilterPreset,
  FilterPreviewResult,
  FilterRuleSet
} from '@shared/types'
import { getLocAdmDb } from '../db/connection'
import { applyRules } from '../filters/ruleEngine'
import { buildClassifierPrompt, parseClassifierResponse } from '../filters/prompts'
import { startClassifyJob } from '../filters/classifier'
import { getAllDocumentInsightsReal } from '../db/scl-folder'

interface PresetDbRow {
  id: number
  name: string
  ruleJson: string
  createdAt: number
  lastUsed: number | null
}

function rowToPreset(r: PresetDbRow): FilterPreset {
  let ruleSet: FilterRuleSet
  try {
    ruleSet = JSON.parse(r.ruleJson) as FilterRuleSet
  } catch {
    ruleSet = { rules: [] }
  }
  return {
    id: r.id,
    name: r.name,
    ruleSet,
    createdAt: r.createdAt,
    lastUsed: r.lastUsed ?? undefined
  }
}

function loadLabels(): Map<number, AiLabel> {
  const db = getLocAdmDb()
  const rows = db
    .prepare('SELECT fileId, label FROM FileAiLabels')
    .all() as Array<{ fileId: number; label: AiLabel }>
  return new Map(rows.map((r) => [r.fileId, r.label]))
}

export function registerFilterHandlers(): void {
  const db = getLocAdmDb()

  ipcMain.handle(
    IpcChannel.FiltersPreview,
    (_evt, ruleSet: FilterRuleSet): FilterPreviewResult => {
      const files = getAllDocumentInsightsReal(ruleSet.folder)
      const labels = loadLabels()
      return applyRules(ruleSet, files, labels)
    }
  )

  ipcMain.handle(IpcChannel.FiltersListPresets, (): FilterPreset[] => {
    const rows = db
      .prepare('SELECT * FROM FilterPresets ORDER BY lastUsed DESC, createdAt DESC')
      .all() as PresetDbRow[]
    return rows.map(rowToPreset)
  })

  ipcMain.handle(
    IpcChannel.FiltersSavePreset,
    (_evt, name: string, ruleSet: FilterRuleSet): FilterPreset => {
      const trimmed = name.trim()
      if (!trimmed) throw new Error('VALIDATION: Preset name is required')
      const now = Date.now()
      db.prepare(
        `INSERT INTO FilterPresets (name, ruleJson, createdAt, lastUsed)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(name) DO UPDATE SET
           ruleJson = excluded.ruleJson,
           lastUsed = excluded.lastUsed`
      ).run(trimmed, JSON.stringify(ruleSet), now, now)
      // Always look up by unique name rather than relying on lastInsertRowid,
      // whose behavior across INSERT-vs-upsert is SQLite-version-dependent.
      const row = db
        .prepare('SELECT * FROM FilterPresets WHERE name = ?')
        .get(trimmed) as PresetDbRow
      return rowToPreset(row)
    }
  )

  ipcMain.handle(IpcChannel.FiltersDeletePreset, (_evt, id: number) => {
    db.prepare('DELETE FROM FilterPresets WHERE id = ?').run(id)
  })

  ipcMain.handle(
    IpcChannel.FiltersClassify,
    (_evt, req: ClassifyRequest): { jobId: string } => {
      return startClassifyJob(req)
    }
  )

  ipcMain.handle(
    IpcChannel.FiltersClipboardPrompt,
    (_evt, filenames: ClassifyFileInput[]): ClipboardPromptResult => {
      return { prompt: buildClassifierPrompt(filenames), filenames }
    }
  )

  ipcMain.handle(
    IpcChannel.FiltersClipboardApply,
    (
      _evt,
      filenames: ClassifyFileInput[],
      responseText: string
    ): ClassifiedFilename[] => {
      const labels = parseClassifierResponse(responseText, filenames)
      // Persist so future previews see these labels.
      if (labels.length > 0) {
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
            stmt.run(
              r.fileId,
              r.label,
              r.confidence,
              'clipboard:external',
              ts,
              r.reason ?? null
            )
          }
        })
        tx(labels)
      }
      return labels
    }
  )
}
