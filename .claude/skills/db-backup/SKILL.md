---
name: db-backup
description: Copy src/src/db_files/loc_adm.db to a timestamped backup file before any destructive DB change. Use BEFORE running any INSERT/UPDATE/DELETE/DROP/ALTER, before schema migrations, or whenever the user asks to "back up the DB".
---

# db-backup

Cheap insurance against losing the only source of truth in this project. Run before any DML/DDL, schema change, or experimental query.

## Backup

```bash
cd "d:/Client-Side Project/ElectronAdmin2/src/src/db_files" && cp loc_adm.db "loc_adm.backup.$(date +%Y%m%d-%H%M%S).db"
```

Then `ls -la loc_adm.backup.*.db` to confirm the file landed and report its size + timestamp back to the user.

## When to use

- About to run any `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `CREATE TABLE`, `REPLACE`, `VACUUM` against `loc_adm.db`
- About to add a missing table (e.g. `OCR_Process` for the Progress tab)
- Before changing column types or constraints
- Before any code change that runs DB writes on first launch

## When NOT to use

- Read-only `SELECT` queries — no need
- Inspecting schema via `sqlite_master` — no need
- Running the app normally — only IPC handlers write, and most are user-driven

## Restore

If a change goes wrong, restore the most recent backup:

```bash
cd "d:/Client-Side Project/ElectronAdmin2/src/src/db_files" && ls -t loc_adm.backup.*.db | head -1 | xargs -I {} cp {} loc_adm.db
```

**Confirm with the user before restoring** — this overwrites current state.

## Housekeeping

`*.db` is gitignored (see [.gitignore](../../../.gitignore)) so backups never get committed. They accumulate in `db_files/` though — periodically suggest pruning ones older than a week.
