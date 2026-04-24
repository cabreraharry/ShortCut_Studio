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
  }

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
}
