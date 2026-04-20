---
description: Inspect the SCL_Admin SQLite database. Pass a SQL query as the argument, or omit for a full schema + row-count summary.
argument-hint: [SQL query, e.g. "SELECT * FROM LLM_Provider"]
---

Run a query against `src/src/db_files/loc_adm.db` via the bundled `sqlite3` npm module.

If the user passed SQL as `$ARGUMENTS`, run that. Reject any DML/DDL (INSERT/UPDATE/DELETE/DROP/ALTER/CREATE/REPLACE/ATTACH/VACUUM) and ask for explicit confirmation.

If `$ARGUMENTS` is empty, dump:
- All tables and their `CREATE TABLE` SQL
- Row counts per table
- The single `AdminData` row
- The default `LLM_Provider` (`IsDefault='Y'`) and its default `Models` row (`ProviderDefault='Y'`)

Use this template (replace `<SQL>` and quote-escape carefully):

```bash
cd "d:/Client-Side_Project/ElectronAdmin2/src/src" && node -e "
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('db_files/loc_adm.db');
db.all(\`<SQL>\`, (e, r) => { if (e) { console.error(e.message); process.exit(1); } console.log(JSON.stringify(r, null, 2)); db.close(); });
"
```

Output the JSON result. Flag any oddities (truncated keys, multi-default rows, missing `OCR_Process` table).
