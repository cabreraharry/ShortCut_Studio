import Database from 'better-sqlite3'
import { app } from 'electron'
import { existsSync, mkdirSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { getMode } from '../ipc/mode'
import { getLocAdmDb } from './connection'
import type {
  DedupSummary,
  DocumentInsight,
  InsightsGroup,
  InsightsListParams,
  InsightsListResult,
  InsightsSortKey,
  SortDirection,
  TopicDistribution,
  TopicReviewItem
} from '@shared/types'

/**
 * Read-only accessor for SCL_Demo's per-mode scan databases.
 *
 * SCL_Demo writes scan + topic data into SCLFolder_Publ.db / SCLFolder_Priv.db.
 * The Electron client reads them — never writes (that's the scanner's job).
 *
 * Path resolution + first-run seeding:
 *   - dev: honour `SCL_DEMO_DB_DIR` env var, otherwise the sibling project at
 *     `D:/Client-Side_Project/SCL_Demo/db_files/`.
 *   - packaged: workers + client share `<userData>/scl_data/db_files/`. The
 *     supervisor sets `SCL_DEMO_DATA_ROOT=<userData>/scl_data` for spawned
 *     Python workers (see workers/supervisor.ts) so their resolver short-
 *     circuits to that path instead of walking up from sys.executable looking
 *     for a `db_files/` ancestor (which doesn't exist in the install layout).
 *     On first launch, the bundled seed at
 *     `process.resourcesPath/scl_data_seed/db_files/*` is copied across — see
 *     `seedDataRootIfNeeded()`. v0.3.x users get a one-time migration from
 *     the old `<userData>/scl_db_files/` layout.
 */

const DEV_DEFAULT_DB_DIR = 'D:/Client-Side_Project/SCL_Demo/db_files'
const SEED_FILES = [
  'config.json',
  'Support_priv_list.json',
  'Ignore_publ_list.json',
  'zine_mappings.json',
  'SCLFolder_Publ.db',
  'SCLFolder_Priv.db'
]

/**
 * Returns the per-user "data root" used by the Python workers in packaged
 * builds. The workers expect a `db_files/` subdirectory inside this path.
 *
 * Available even before the seed-copy completes — the supervisor passes this
 * value to spawned workers via `SCL_DEMO_DATA_ROOT` so worker startup waits
 * on filesystem readiness, not on this function being called first.
 */
export function sclDataRootDir(): string {
  return join(app.getPath('userData'), 'scl_data')
}

let seedAttempted = false

function seedDataRootIfNeeded(): void {
  if (seedAttempted || !app.isPackaged) return
  seedAttempted = true

  const dbFilesDir = join(sclDataRootDir(), 'db_files')
  mkdirSync(dbFilesDir, { recursive: true })

  // v0.3.x → v0.4.x migration. Old layout had only the SCLFolder DBs at
  // <userData>/scl_db_files/. New layout is <userData>/scl_data/db_files/
  // and includes config.json + ignore lists. Move any pre-existing files
  // across before falling through to the bundled seed copy. No-op when
  // the legacy dir doesn't exist (fresh installs).
  const legacyDir = join(app.getPath('userData'), 'scl_db_files')
  if (existsSync(legacyDir)) {
    for (const name of SEED_FILES) {
      const legacy = join(legacyDir, name)
      const target = join(dbFilesDir, name)
      if (existsSync(legacy) && !existsSync(target)) {
        try {
          copyFileSync(legacy, target)
        } catch {
          // Non-fatal — fall through to seed copy below.
        }
      }
    }
  }

  // Fresh-install seed copy. Skip files that already exist (either from the
  // v0.3.x migration above or from a prior launch of this version).
  const seedDir = join(process.resourcesPath, 'scl_data_seed', 'db_files')
  for (const name of SEED_FILES) {
    const target = join(dbFilesDir, name)
    const seed = join(seedDir, name)
    if (!existsSync(target) && existsSync(seed)) {
      try {
        copyFileSync(seed, target)
      } catch {
        // Non-fatal: missing seed just means we open nothing until SCL_Demo
        // produces the file. withSclFolderDb() handles the empty case.
      }
    }
  }
}

function sclDbDir(): string {
  if (process.env['SCL_DEMO_DB_DIR']) return process.env['SCL_DEMO_DB_DIR']
  if (app.isPackaged) {
    seedDataRootIfNeeded()
    return join(sclDataRootDir(), 'db_files')
  }
  return DEV_DEFAULT_DB_DIR
}

function dbFileName(): string {
  return getMode() === 'priv' ? 'SCLFolder_Priv.db' : 'SCLFolder_Publ.db'
}

/**
 * Open a read-only connection to the currently active mode's DB.
 * Returns null if the DB file does not exist (e.g. user hasn't run a scan yet).
 */
export function openSclFolderDb(): Database.Database | null {
  const path = join(sclDbDir(), dbFileName())
  if (!existsSync(path)) return null
  try {
    return new Database(path, { readonly: true, fileMustExist: true })
  } catch {
    return null
  }
}

export function withSclFolderDb<T>(fn: (db: Database.Database) => T, fallback: T): T {
  const db = openSclFolderDb()
  if (!db) return fallback
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

// ---------- Query helpers (real reads, replacing src/main/mock/insights.ts) ----------
//
// All helpers return safe empty/zero values via withSclFolderDb's fallback when
// the per-mode DB doesn't exist yet (fresh install, mode never scanned). This
// keeps the UI navigable before the first scan completes.

function leafFolder(folderPath: string): string {
  const cleaned = folderPath.replace(/[\\/]+$/, '')
  const parts = cleaned.split(/[\\/]/)
  return parts[parts.length - 1] || cleaned
}

function fullPath(folderPath: string, fileName: string): string {
  const sep = folderPath.includes('\\') || /^[A-Za-z]:/.test(folderPath) ? '\\' : '/'
  const trimmed = folderPath.replace(/[\\/]+$/, '')
  return `${trimmed}${sep}${fileName}`
}

function normalizePathPrefix(p: string): string {
  return p.replace(/[\\/]+$/, '')
}

// Strip the trailing filename segment (works for both `\` and `/` separators).
function parentOf(fp: string): string {
  return fp.replace(/[\\/][^\\/]+$/, '')
}

// SQLite LIKE treats `_` and `%` as wildcards. We use `|` as the escape char
// (backslash is too easy to collide with Windows path data). Every helper that
// does a path-prefix LIKE must pair the escaped pattern with `ESCAPE '|'`.
function escapeLike(s: string): string {
  return s.replace(/[|_%]/g, (c) => `|${c}`)
}

interface FilesRow {
  FileID: number
  FileName: string
  FolderPath: string
  Probability: number
  PageNum: number
  Duplicate: 'Y' | 'N'
  IgnoreFile: 'Y' | 'N'
}

function rowToInsight(r: FilesRow): DocumentInsight {
  return {
    fileId: r.FileID,
    fileName: r.FileName,
    fullPath: fullPath(r.FolderPath, r.FileName),
    // Probability is INTEGER 0..100 in SCLFolder. PageNum is -1 when unknown.
    extractionPct: Math.max(0, Math.min(100, r.Probability)),
    pageCount: r.PageNum >= 0 ? r.PageNum : 0,
    // SCLFolder schema has no warnings column; leave 0 until the scanner
    // exposes a usable signal (Files.F_ModifiedStatus is a candidate).
    warnings: 0
  }
}

const FILES_BASE_SQL = `
  SELECT f.FileID, f.FileName, fd.FolderPath, f.Probability, f.PageNum,
         f.Duplicate, f.IgnoreFile
  FROM Files f
  JOIN Folders fd ON f.FolderID = fd.FolderID
  WHERE f.IgnoreFile = 'N'
`

export function getDedupSummaryReal(): DedupSummary {
  return withSclFolderDb<DedupSummary>(
    (db) => {
      const row = db
        .prepare(
          `SELECT
             COUNT(*) AS totalDocs,
             COUNT(DISTINCT IFNULL(fdup.MasterID, f.FileID)) AS uniqueMasterIds
           FROM Files f
           LEFT JOIN FileDuplicates fdup ON fdup.FileID = f.FileID
           WHERE f.IgnoreFile = 'N'`
        )
        .get() as { totalDocs: number; uniqueMasterIds: number }
      const totalDocs = row.totalDocs ?? 0
      const uniqueMasterIds = row.uniqueMasterIds ?? 0
      const dedupPct =
        totalDocs === 0
          ? 0
          : Math.round(((totalDocs - uniqueMasterIds) / totalDocs) * 1000) / 10
      return { totalDocs, uniqueMasterIds, dedupPct }
    },
    { totalDocs: 0, uniqueMasterIds: 0, dedupPct: 0 }
  )
}

/**
 * Folder health for a configured root folder (path comes from loc_adm.db's
 * Folder table). Note `loc_adm.Folder.ID` is unrelated to `SCLFolder.Folders.FolderID`,
 * so we resolve via path-prefix LIKE — every SCLFolder row whose FolderPath
 * is at-or-below the configured root counts.
 *
 * Caller passes the configured root path. If two configured roots share an
 * ancestor (e.g. C:\Papers and C:\Papers\NeurIPS), they double-count files in
 * the shared subtree — accepted for v1.
 */
export function getFolderHealthReal(folderPath: string): {
  fileCount: number
  dupeCount: number
  privacyMatchCount: number
} {
  if (!folderPath) return { fileCount: 0, dupeCount: 0, privacyMatchCount: 0 }
  const prefix = normalizePathPrefix(folderPath)
  // Match either the folder itself or any descendant. Escape `_`/`%` in the
  // user-supplied path before stitching it into the LIKE pattern, otherwise a
  // path like `C:\Papers_2026` would match `C:\PapersX2026` too.
  const escaped = escapeLike(prefix)
  const likeWin = `${escaped}\\%`
  const likeUnix = `${escaped}/%`

  const counts = withSclFolderDb<{ fileCount: number; dupeCount: number }>(
    (db) => {
      const row = db
        .prepare(
          `SELECT
             SUM(CASE WHEN f.IgnoreFile = 'N' THEN 1 ELSE 0 END) AS fileCount,
             SUM(CASE WHEN f.IgnoreFile = 'N' AND f.Duplicate = 'Y' THEN 1 ELSE 0 END) AS dupeCount
           FROM Files f
           JOIN Folders fd ON f.FolderID = fd.FolderID
           WHERE fd.FolderPath = ?
              OR fd.FolderPath LIKE ? ESCAPE '|'
              OR fd.FolderPath LIKE ? ESCAPE '|'`
        )
        .get(prefix, likeWin, likeUnix) as
        | { fileCount: number | null; dupeCount: number | null }
        | undefined
      return {
        fileCount: row?.fileCount ?? 0,
        dupeCount: row?.dupeCount ?? 0
      }
    },
    { fileCount: 0, dupeCount: 0 }
  )

  // Privacy term matches: scan filenames against PrivacyTerms in loc_adm.db.
  // Cross-DB join would need ATTACH; simpler to read the term list and run
  // a per-term LIKE against SCLFolder Files. Term counts are tiny in practice.
  const terms = (
    getLocAdmDb()
      .prepare('SELECT term FROM PrivacyTerms')
      .all() as Array<{ term: string }>
  )
    .map((r) => r.term?.trim())
    .filter((t): t is string => Boolean(t))

  const privacyMatchCount =
    terms.length === 0
      ? 0
      : withSclFolderDb<number>(
          (db) => {
            // OR-chain of LIKEs. Bounded by terms.length (system seeds are 7;
            // user-added terms add a few more). DISTINCT FileID so a single
            // file matching multiple terms isn't double-counted. Each term is
            // also escape-quoted to keep `_`/`%` from being treated as wildcards.
            const conds = terms.map(() => "LOWER(f.FileName) LIKE ? ESCAPE '|'").join(' OR ')
            const params = terms.map((t) => `%${escapeLike(t.toLowerCase())}%`)
            const row = db
              .prepare(
                `SELECT COUNT(DISTINCT f.FileID) AS c
                 FROM Files f
                 JOIN Folders fd ON f.FolderID = fd.FolderID
                 WHERE f.IgnoreFile = 'N'
                   AND (
                     fd.FolderPath = ?
                     OR fd.FolderPath LIKE ? ESCAPE '|'
                     OR fd.FolderPath LIKE ? ESCAPE '|'
                   )
                   AND (${conds})`
              )
              .get(prefix, likeWin, likeUnix, ...params) as { c: number } | undefined
            return row?.c ?? 0
          },
          0
        )

  return { ...counts, privacyMatchCount }
}

export function getAllDocumentInsightsReal(folder?: string): DocumentInsight[] {
  return withSclFolderDb<DocumentInsight[]>((db) => {
    const rows = db.prepare(FILES_BASE_SQL).all() as FilesRow[]
    const all = rows.map(rowToInsight)
    if (!folder) return all
    return all.filter((r) => leafFolder(parentOf(r.fullPath)) === folder)
  }, [])
}

const MAX_LIMIT = 500
const DEFAULT_LIMIT = 100

function compareBy(key: InsightsSortKey, dir: SortDirection) {
  const m = dir === 'asc' ? 1 : -1
  return (a: DocumentInsight, b: DocumentInsight): number => {
    switch (key) {
      case 'name':
        return a.fileName.localeCompare(b.fileName) * m
      case 'extraction':
        return (a.extractionPct - b.extractionPct) * m
      case 'warnings':
        return (a.warnings - b.warnings) * m
      case 'pages':
        return (a.pageCount - b.pageCount) * m
    }
  }
}

export function listDocumentInsightsReal(params?: InsightsListParams): InsightsListResult {
  const all = getAllDocumentInsightsReal()
  const q = (params?.search ?? '').trim().toLowerCase()
  const folderFilter = params?.folder
  const filtered = all.filter((r) => {
    if (q && !r.fileName.toLowerCase().includes(q)) return false
    if (folderFilter && leafFolder(parentOf(r.fullPath)) !== folderFilter) return false
    return true
  })

  const sortKey: InsightsSortKey = params?.sort ?? 'name'
  const sortDir: SortDirection = params?.sortDir ?? 'asc'
  const sorted = [...filtered].sort(compareBy(sortKey, sortDir))

  const offset = Math.max(0, params?.offset ?? 0)
  const limit = Math.min(MAX_LIMIT, Math.max(1, params?.limit ?? DEFAULT_LIMIT))

  let sumExtraction = 0
  let lowConfidenceCount = 0
  let totalWarnings = 0
  for (const r of filtered) {
    sumExtraction += r.extractionPct
    if (r.extractionPct < 85) lowConfidenceCount++
    totalWarnings += r.warnings
  }
  const avgExtractionPct =
    filtered.length === 0 ? 0 : Math.round(sumExtraction / filtered.length)

  return {
    rows: sorted.slice(offset, offset + limit),
    total: sorted.length,
    offset,
    limit,
    aggregates: { avgExtractionPct, lowConfidenceCount, totalWarnings }
  }
}

export function listInsightsGroupsReal(params?: { search?: string }): InsightsGroup[] {
  const all = getAllDocumentInsightsReal()
  const q = (params?.search ?? '').trim().toLowerCase()
  const filtered = q ? all.filter((r) => r.fileName.toLowerCase().includes(q)) : all

  const byFolder = new Map<
    string,
    { sumExtraction: number; low: number; warn: number; count: number }
  >()
  for (const r of filtered) {
    // Use the leaf-folder of the file's parent path for grouping (matches the
    // mock's folderOf semantics).
    const folder = leafFolder(parentOf(r.fullPath))
    const agg = byFolder.get(folder) ?? { sumExtraction: 0, low: 0, warn: 0, count: 0 }
    agg.sumExtraction += r.extractionPct
    if (r.extractionPct < 85) agg.low++
    agg.warn += r.warnings
    agg.count++
    byFolder.set(folder, agg)
  }

  return Array.from(byFolder.entries())
    .map(([folder, agg]) => ({
      folder,
      fileCount: agg.count,
      avgExtractionPct: agg.count === 0 ? 0 : Math.round(agg.sumExtraction / agg.count),
      lowConfidenceCount: agg.low,
      totalWarnings: agg.warn
    }))
    .sort((a, b) => a.folder.localeCompare(b.folder))
}

/**
 * Per-stage processing counts read from the active SCLFolder DB. Columns are
 * mapped to artifact stages based on what each part of SCL_Demo's pipeline
 * writes:
 *   - **scan**: text was extracted at least once from the file. Use the OR of
 *     `Words500 != ''` and `Probability > 0` because Words500 may be cleared
 *     after Gemini has consumed it — the union counts files that have made it
 *     past the extraction step regardless of whether the column was later
 *     pruned.
 *   - **llm**:   `Probability > 0` (Gemini ran on the file's preview text).
 *   - **km**:    file appears in TopicFiles (joined to a topic). Empty until
 *                topic generation has run on this library.
 *
 * No column tracks "References / citation list extracted" yet — see
 * RealLocalExecEngineClient for the estimated-coefficient handling.
 */
export function getStageProgressCounts(): {
  totalFiles: number
  scan: number
  llm: number
  km: number
} {
  return withSclFolderDb<{ totalFiles: number; scan: number; llm: number; km: number }>(
    (db) => {
      const row = db
        .prepare(
          `SELECT
             COUNT(*) AS totalFiles,
             SUM(CASE WHEN Words500 != '' OR Probability > 0 THEN 1 ELSE 0 END) AS scan,
             SUM(CASE WHEN Probability > 0 THEN 1 ELSE 0 END) AS llm,
             SUM(CASE WHEN EXISTS (
               SELECT 1 FROM TopicFiles tf WHERE tf.FileID = Files.FileID
             ) THEN 1 ELSE 0 END) AS km
           FROM Files
           WHERE IgnoreFile = 'N'`
        )
        .get() as
        | { totalFiles: number; scan: number | null; llm: number | null; km: number | null }
        | undefined
      return {
        totalFiles: row?.totalFiles ?? 0,
        scan: row?.scan ?? 0,
        llm: row?.llm ?? 0,
        km: row?.km ?? 0
      }
    },
    { totalFiles: 0, scan: 0, llm: 0, km: 0 }
  )
}

/**
 * Topic review queue: topics gemini_processor has assigned to files but
 * topic_watchdog / manageLink hasn't yet promoted to the TopicNames table.
 * Once promoted, a topic shows up in TopicsList (the materialised dimension);
 * before promotion, it lives here so the user can see what was just inferred.
 *
 * One row per distinct Files.TopicNames value, with the highest-confidence
 * sample for that topic. Empty when no scans + topic generation have run yet.
 */
export function getRealTopicReview(): TopicReviewItem[] {
  return withSclFolderDb<TopicReviewItem[]>((db) => {
    const rows = db
      .prepare(
        `WITH topical AS (
           SELECT f.TopicNames AS topic,
                  f.FileID, f.FileName, f.SearchText, f.LinkName, f.Probability
             FROM Files f
            WHERE f.IgnoreFile = 'N'
              AND f.Probability > 0
              AND f.TopicNames IS NOT NULL
              AND f.TopicNames != ''
              AND NOT EXISTS (
                SELECT 1 FROM TopicNames tn WHERE tn.TopicName = f.TopicNames
              )
         ),
         ranked AS (
           SELECT t.*,
                  ROW_NUMBER() OVER (PARTITION BY t.topic ORDER BY t.Probability DESC, t.FileID) AS rk,
                  COUNT(*) OVER (PARTITION BY t.topic) AS topicFileCount,
                  AVG(t.Probability * 1.0) OVER (PARTITION BY t.topic) AS avgConfidence
             FROM topical t
         )
         SELECT topic, FileID, FileName, SearchText, LinkName, avgConfidence, topicFileCount
           FROM ranked
          WHERE rk = 1
          ORDER BY avgConfidence DESC, topicFileCount DESC
          LIMIT 50`
      )
      .all() as Array<{
        topic: string
        FileID: number
        FileName: string | null
        SearchText: string | null
        LinkName: string | null
        avgConfidence: number | null
        topicFileCount: number
      }>

    return rows.map((r) => {
      // Sample 3 filenames per topic (the highest-prob row already chosen
      // is representative; pulling a per-topic sublist costs another query).
      // Leaving sampleFiles empty keeps the row payload tight.
      return {
        suggestedTopic: r.topic,
        fileId: r.FileID,
        fileName: r.FileName ?? '(no filename)',
        searchText: r.SearchText ?? '',
        linkName: r.LinkName ?? '',
        confidence: r.avgConfidence != null ? r.avgConfidence / 100 : undefined,
        sampleFiles: r.FileName ? [r.FileName] : []
      }
    })
  }, [])
}

/**
 * Topic distribution chart data: file count per topic, descending.
 * Reads directly from Files.TopicNames (gemini_processor's raw output)
 * rather than the TopicNames table, so the chart is populated as soon as
 * the LLM labels files — no waiting for topic_watchdog promotion.
 */
export function getRealTopicDistribution(): TopicDistribution[] {
  return withSclFolderDb<TopicDistribution[]>((db) => {
    const rows = db
      .prepare(
        `SELECT TopicNames AS topic, COUNT(*) AS fileCount
           FROM Files
          WHERE IgnoreFile = 'N'
            AND TopicNames IS NOT NULL
            AND TopicNames != ''
          GROUP BY TopicNames
          ORDER BY fileCount DESC, topic ASC
          LIMIT 30`
      )
      .all() as Array<{ topic: string; fileCount: number }>
    return rows.map((r) => ({ topic: r.topic, fileCount: r.fileCount }))
  }, [])
}

/**
 * Real local progress: total files (denominator) and processed files
 * (Probability > 0 — SCL_Demo's gemini_processor sets this once a topic is
 * generated). Used by RealLocalExecEngineClient.getProgressSummary.
 */
export function getLocalProgressCounts(): { totalFiles: number; processedLocal: number } {
  return withSclFolderDb<{ totalFiles: number; processedLocal: number }>(
    (db) => {
      const row = db
        .prepare(
          `SELECT
             COUNT(*) AS totalFiles,
             SUM(CASE WHEN Probability > 0 THEN 1 ELSE 0 END) AS processedLocal
           FROM Files
           WHERE IgnoreFile = 'N'`
        )
        .get() as { totalFiles: number; processedLocal: number | null } | undefined
      return {
        totalFiles: row?.totalFiles ?? 0,
        processedLocal: row?.processedLocal ?? 0
      }
    },
    { totalFiles: 0, processedLocal: 0 }
  )
}
