---
description: Inspect the ShortCut Studio SQLite database. Pass a SQL query as the argument, or omit for a full schema + row-count summary.
argument-hint: [SQL query, e.g. "SELECT * FROM LLM_Provider"]
---

Run a query against `src/src/db_files/loc_adm.db` via the bundled `better-sqlite3` module.

If the user passed SQL as `$ARGUMENTS`, run that. Reject any DML/DDL (INSERT/UPDATE/DELETE/DROP/ALTER/CREATE/REPLACE/ATTACH/VACUUM) and ask for explicit confirmation.

If `$ARGUMENTS` is empty, dump:
- All tables and their `CREATE TABLE` SQL
- Row counts per table
- The single `AdminData` row
- The default `LLM_Provider` (`IsDefault='Y'`) and its default `Models` row (`ProviderDefault='Y'`)

Use this template (replace `<SQL>` and quote-escape carefully):

```bash
cd "d:/Client-Side_Project/ShortCut_Studio/src/src" && node -e "
const Database = require('better-sqlite3');
const db = new Database('db_files/loc_adm.db', { readonly: true });
console.log(JSON.stringify(db.prepare(\`<SQL>\`).all(), null, 2));
db.close();
"
```

Output the JSON result. Flag any oddities (truncated keys, multi-default rows, missing tables).
