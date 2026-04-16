---
name: sqlite-query
description: Run a one-shot read-only SQL query against the project's SQLite DB (src/src/db_files/loc_adm.db) and print the results as JSON. Use whenever the user asks to inspect rows, dump tables, or check counts. Pass the SQL as the skill argument.
---

# sqlite-query

Read-only SQL helper for the project DB. The CLI `sqlite3` binary is NOT installed on this Windows box, but the `sqlite3` npm module is already built inside `src/src/node_modules`, so we shell into Node instead.

## Usage

The user gives you a SQL string as the argument. Refuse anything that contains `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `CREATE`, `REPLACE`, `ATTACH`, `DETACH`, `PRAGMA writable_schema`, or `VACUUM` (case-insensitive). For those, tell the user to ask explicitly and re-confirm before proceeding.

## How to run

```bash
cd "d:/Client-Side Project/ElectronAdmin2/src/src" && node -e "
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('db_files/loc_adm.db');
db.all(\`<SQL_HERE>\`, (err, rows) => {
  if (err) { console.error('ERR:', err.message); process.exit(1); }
  console.log(JSON.stringify(rows, null, 2));
  db.close();
});
"
```

Replace `<SQL_HERE>` with the user's query, properly escaped.

## Schema cheat-sheet

```
AdminData(RecID, Localhost_Port, NumTopicThreshold, CPU_Perf_Threshold)
Folder(ID, Path, Include 'Y'|'N', ProcRound, LastUpd_CT)
LLM_Provider(Provider_ID, Provider_Name, Has_API_Key, API_Key, API_Host,
             IsDefault, Supported, AllowAddModel)
Models(ModelID, ProviderID, ModelName, ProviderDefault)
```

`OCR_Process` is referenced by code but does NOT exist in the DB. Mention this if the user queries it.

## Output

Print the JSON result. If empty, say "no rows". If a column is suspiciously truncated (e.g. an `API_Key` exactly 50 chars), flag it — `API_Key` is `VARCHAR(50)` and silently truncates longer keys.
