---
name: sqlite-query
description: Run a one-shot read-only SQL query against the project's SQLite DB (src/src/db_files/loc_adm.db) and print the results as JSON. Use whenever the user asks to inspect rows, dump tables, or check counts. Pass the SQL as the skill argument.
---

# sqlite-query

Read-only ad-hoc query against `loc_adm.db`. Uses `better-sqlite3` (already installed in the project) via Node.

## When to invoke

- User asks to "inspect", "count", "list", "dump", "show rows" from a table
- Debugging why an IPC handler returns empty or wrong data
- Sanity-checking a migration before running a write

## Refuse if…

The SQL contains `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `CREATE`, `REPLACE`, `ATTACH`, `DETACH`, `PRAGMA writable_schema`, or `VACUUM` (case-insensitive). For those, suggest running the `db-backup` skill first and then asking explicitly — better yet, put the change in `src/main/db/migrations.ts`.

## How to run

```bash
cd "d:/Client-Side_Project/ElectronAdmin2/src/src" && node -e "
const db = require('better-sqlite3')('db_files/loc_adm.db', { readonly: true });
try {
  console.log(JSON.stringify(db.prepare(process.argv[1]).all(), null, 2));
} catch (err) {
  console.error('ERR:', err.message); process.exit(1);
}
db.close();
" -- "<SQL_HERE>"
```

Replace `<SQL_HERE>` with the user's query — pass via `--` to avoid shell quoting confusion.

## Schema cheat-sheet

```
AdminData(RecID, Localhost_Port, NumTopicThreshold, CPU_Perf_Threshold)
Folder(ID, Path, Include 'Y'|'N', ProcRound, LastUpd_CT)
LLM_Provider(Provider_ID, Provider_Name, Has_API_Key, API_Key, API_Host,
             IsDefault, Supported, AllowAddModel)
Models(ModelID, ProviderID, ModelName, ProviderDefault)
OCR_Process(JobID, Kind, Status, Label, StartedAt, FinishedAt,
            ProgressCurrent, ProgressTotal, Error)
SuperCategories(SuperCategoryID, Name)
TopicSuperCategoryMap(topicName, superCategoryId)
ProgressSnapshots(ts, cumulativeLocal, cumulativePeer)
PrivacyTerms(id, term, source 'system'|'user')
LLM_Usage(id, providerId, tokensIn, tokensOut, ts)
FileTypeFilters(extension, label, enabled 0|1, sortOrder)
```

## Output

Print the JSON result. If empty, say "no rows". If a column value is exactly 50 chars long on `API_Key`, flag it — the original schema was `VARCHAR(50)`; migrations widened new installs to `TEXT` but older data may still be truncated.

## If the DB doesn't exist yet

Run `npm run dev` once so `runMigrations()` creates the schema and seeds defaults, then re-run the query.
