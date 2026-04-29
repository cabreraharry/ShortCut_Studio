import { getLocAdmDb } from './connection'

/**
 * Idempotent schema migrations for loc_adm.db.
 *
 * Pre-existing tables (AdminData, Folder, LLM_Provider, Models) carry
 * VARCHAR(50) paths and API keys that truncate real values. We widen
 * them via new tables if schema drift is detected, but since SQLite
 * treats VARCHAR(50) as TEXT at runtime anyway, the column type string
 * is cosmetic — we only add missing tables/columns here.
 */
export function runMigrations(): void {
  const db = getLocAdmDb()

  db.exec(`
    CREATE TABLE IF NOT EXISTS AdminData (
      RecID INTEGER PRIMARY KEY DEFAULT 1,
      Localhost_Port INTEGER NOT NULL DEFAULT 44999,
      NumTopicThreshold INTEGER NOT NULL DEFAULT 10,
      CPU_Perf_Threshold INTEGER NOT NULL DEFAULT 50
    );

    CREATE TABLE IF NOT EXISTS Folder (
      ID INTEGER PRIMARY KEY,
      Path TEXT NOT NULL,
      Include TEXT NOT NULL DEFAULT 'Y',
      ProcRound INTEGER NOT NULL DEFAULT 0,
      LastUpd_CT INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS LLM_Provider (
      Provider_ID INTEGER PRIMARY KEY,
      Provider_Name TEXT NOT NULL,
      Has_API_Key TEXT NOT NULL DEFAULT 'N',
      API_Key TEXT NOT NULL DEFAULT '',
      API_Host TEXT NOT NULL DEFAULT '',
      IsDefault TEXT NOT NULL DEFAULT 'N',
      Supported TEXT NOT NULL DEFAULT 'N',
      AllowAddModel TEXT NOT NULL DEFAULT 'N'
    );

    CREATE TABLE IF NOT EXISTS Models (
      ModelID INTEGER PRIMARY KEY,
      ProviderID INTEGER NOT NULL,
      ModelName TEXT NOT NULL,
      ProviderDefault TEXT NOT NULL DEFAULT 'N'
    );

    CREATE TABLE IF NOT EXISTS OCR_Process (
      JobID INTEGER PRIMARY KEY AUTOINCREMENT,
      Kind TEXT NOT NULL,
      Status TEXT NOT NULL DEFAULT 'queued',
      Label TEXT,
      StartedAt INTEGER,
      FinishedAt INTEGER,
      ProgressCurrent INTEGER DEFAULT 0,
      ProgressTotal INTEGER DEFAULT 0,
      Error TEXT
    );

    CREATE TABLE IF NOT EXISTS SuperCategories (
      SuperCategoryID INTEGER PRIMARY KEY AUTOINCREMENT,
      Name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS ProgressSnapshots (
      ts INTEGER PRIMARY KEY,
      cumulativeLocal INTEGER NOT NULL DEFAULT 0,
      cumulativePeer INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS PrivacyTerms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      term TEXT NOT NULL UNIQUE,
      source TEXT NOT NULL CHECK (source IN ('system', 'user'))
    );

    CREATE TABLE IF NOT EXISTS LLM_Usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      providerId INTEGER NOT NULL,
      tokensIn INTEGER NOT NULL DEFAULT 0,
      tokensOut INTEGER NOT NULL DEFAULT 0,
      ts INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS FileTypeFilters (
      extension TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      sortOrder INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS TopicSuperCategoryMap (
      topicName TEXT PRIMARY KEY,
      superCategoryId INTEGER NOT NULL REFERENCES SuperCategories(SuperCategoryID) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS FilterPresets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      ruleJson TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      lastUsed INTEGER
    );

    CREATE TABLE IF NOT EXISTS FileAiLabels (
      fileId INTEGER PRIMARY KEY,
      label TEXT NOT NULL CHECK (label IN ('publication', 'other', 'unlabeled')),
      confidence REAL NOT NULL DEFAULT 0,
      model TEXT NOT NULL,
      classifiedAt INTEGER NOT NULL,
      reason TEXT
    );

  `)

  // One-off destructive op (carve-out from the "additions only" rule in
  // CLAUDE.md): the soft-warn LLM_Budgets table was shipped briefly then
  // ripped out — local-computed spend was misleading and rotted with
  // provider price changes. Real usage now lives on the provider's own
  // dashboards, surfaced via per-card "Open usage dashboard" links.
  // Idempotent: no-op once the table is gone, harmless on fresh installs.
  db.exec('DROP TABLE IF EXISTS LLM_Budgets;')
  // AppErrors table lives in a separate errors.db — see db/errorsConnection.ts.
  // Kept out of loc_adm.db so a future "send debug bundle to support" flow can
  // ship error logs without leaking API keys / paths from this DB.

  // Canonicalise Claude's Provider_Name. An earlier seed variant (or an
  // accidental DB edit) on some installs persisted 'Claude, Anthropic' as the
  // Provider_Name. The dispatcher's PROVIDER_NAME_BY_CODE map only knows
  // 'Claude' as the canonical name, so any misnamed row produces "Unknown
  // provider: Claude, Anthropic" on completion and is invisible to budget
  // seeding (which keys by Provider_Name). UPDATE is idempotent — a no-op
  // when the row is already 'Claude'.
  db.prepare(
    "UPDATE LLM_Provider SET Provider_Name = 'Claude' WHERE Provider_Name = 'Claude, Anthropic'"
  ).run()

  // Seed admin settings row if missing
  const adminRow = db.prepare('SELECT RecID FROM AdminData WHERE RecID = 1').get()
  if (!adminRow) {
    db.prepare('INSERT INTO AdminData (RecID) VALUES (1)').run()
  }

  // Seed default providers if table is empty
  const providerCount = db.prepare('SELECT COUNT(*) AS c FROM LLM_Provider').get() as { c: number }
  if (providerCount.c === 0) {
    const seed = db.prepare(
      `INSERT INTO LLM_Provider
         (Provider_Name, Has_API_Key, API_Host, IsDefault, Supported, AllowAddModel)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    seed.run('Ollama', 'N', 'http://127.0.0.1:11434', 'Y', 'Y', 'Y')
    seed.run('OpenAI', 'N', 'https://api.openai.com', 'N', 'Y', 'N')
    seed.run('Claude', 'N', 'https://api.anthropic.com', 'N', 'Y', 'N')
    seed.run('Gemini', 'N', 'https://generativelanguage.googleapis.com', 'N', 'Y', 'N')
    seed.run('HuggingFace', 'N', 'https://router.huggingface.co/v1', 'N', 'Y', 'Y')
    seed.run('LM Studio', 'N', 'http://localhost:1234/v1', 'N', 'Y', 'N')
  }

  // Backfill providers added after first seed. INSERT only if missing by name
  // so existing user-customised rows (custom hosts, saved API keys) survive.
  const ensureProvider = db.prepare(
    `INSERT INTO LLM_Provider
       (Provider_Name, Has_API_Key, API_Host, IsDefault, Supported, AllowAddModel)
     SELECT ?, ?, ?, 'N', 'Y', ?
     WHERE NOT EXISTS (SELECT 1 FROM LLM_Provider WHERE Provider_Name = ?)`
  )
  ensureProvider.run('HuggingFace', 'N', 'https://router.huggingface.co/v1', 'Y', 'HuggingFace')
  ensureProvider.run('LM Studio', 'N', 'http://localhost:1234/v1', 'N', 'LM Studio')

  // Seed default privacy terms
  const privacyCount = db.prepare('SELECT COUNT(*) AS c FROM PrivacyTerms').get() as { c: number }
  if (privacyCount.c === 0) {
    const defaults = ['personal', 'private', 'confidential', 'draft', 'unreleased', 'ssn', 'passport']
    const insert = db.prepare('INSERT INTO PrivacyTerms (term, source) VALUES (?, ?)')
    for (const term of defaults) insert.run(term, 'system')
  }

  // Seed default file-type filters
  const fileTypeCount = db.prepare('SELECT COUNT(*) AS c FROM FileTypeFilters').get() as {
    c: number
  }
  if (fileTypeCount.c === 0) {
    const seed = db.prepare(
      'INSERT INTO FileTypeFilters (extension, label, enabled, sortOrder) VALUES (?, ?, ?, ?)'
    )
    seed.run('.pdf', 'PDF', 1, 1)
    seed.run('.epub', 'EPUB', 1, 2)
    seed.run('.mobi', 'MOBI', 1, 3)
  }

  // Cleanup: remove unsupported file types that were previously seeded.
  // .azw3 and .djvu are not yet supported by the scanner — they shouldn't
  // appear in the UI as confusing disabled chips. If the user ever adds
  // them back manually (via the "Add extension" input), their choice is
  // preserved since this only runs once per boot.
  db.prepare("DELETE FROM FileTypeFilters WHERE extension IN ('.azw3', '.djvu') AND enabled = 0").run()

  // Idempotent column additions. SQLite's ALTER TABLE ADD COLUMN throws if
  // the column already exists; wrap in try/catch.
  try {
    db.prepare('ALTER TABLE AdminData ADD COLUMN SetupCompleted INTEGER NOT NULL DEFAULT 0').run()
  } catch {
    // column already exists
  }
  try {
    db.prepare('ALTER TABLE AdminData ADD COLUMN WelcomeOnStartup INTEGER NOT NULL DEFAULT 1').run()
  } catch {
    // column already exists
  }
  // LLM_Usage: extend with per-call metadata. All nullable so existing rows
  // (none yet — table is unused at the time of migration) stay valid.
  try {
    db.prepare('ALTER TABLE LLM_Usage ADD COLUMN modelId INTEGER').run()
  } catch {
    // column already exists
  }
  try {
    db.prepare('ALTER TABLE LLM_Usage ADD COLUMN feature TEXT').run()
  } catch {
    // column already exists
  }
  try {
    db.prepare('ALTER TABLE LLM_Usage ADD COLUMN latencyMs INTEGER').run()
  } catch {
    // column already exists
  }
  // ExecEngine connection: SIS host + port (where the auth API lives), plus
  // the most-recently-issued session token so we can stay logged in across
  // app restarts (24-hour validity per SIS docs). Username/password are NEVER
  // persisted — the user re-enters them via a dialog when the token expires.
  try {
    db.prepare("ALTER TABLE AdminData ADD COLUMN ExecEngineSisHost TEXT NOT NULL DEFAULT 'localhost'").run()
  } catch {
    // column already exists
  }
  try {
    db.prepare('ALTER TABLE AdminData ADD COLUMN ExecEngineSisPort INTEGER NOT NULL DEFAULT 44450').run()
  } catch {
    // column already exists
  }
  try {
    db.prepare('ALTER TABLE AdminData ADD COLUMN ExecEngineSessionToken TEXT').run()
  } catch {
    // column already exists
  }
  try {
    db.prepare('ALTER TABLE AdminData ADD COLUMN ExecEngineCpId TEXT').run()
  } catch {
    // column already exists
  }
  try {
    db.prepare('ALTER TABLE AdminData ADD COLUMN ExecEngineMasterId TEXT').run()
  } catch {
    // column already exists
  }
  try {
    db.prepare('ALTER TABLE AdminData ADD COLUMN ExecEngineTokenExpiresAt INTEGER').run()
  } catch {
    // column already exists
  }
}
