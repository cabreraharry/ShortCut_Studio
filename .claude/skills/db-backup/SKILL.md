---
name: db-backup
description: Copy src/src/db_files/loc_adm.db and errors.db to timestamped backup files before any destructive DB change. Use BEFORE running any INSERT/UPDATE/DELETE/DROP/ALTER, before schema migrations, or whenever the user asks to "back up the DB".
---

# db-backup

Cheap insurance against losing the only source of truth in this project. Run before any DML/DDL, schema change, or experimental query.

The app uses **two DB files** under `src/src/db_files/`:
- `loc_adm.db` — config, providers, settings, topics. The main app DB.
- `errors.db` — runtime error log (AppErrors table). Created on first boot.

Back up both unless the user is explicitly only touching one.

## Backup

```bash
cd "d:/Client-Side_Project/ShortCut_Studio/src/src/db_files" && \
  ts=$(date +%Y%m%d-%H%M%S) && \
  cp loc_adm.db "loc_adm.backup.${ts}.db" && \
  ([ -f errors.db ] && cp errors.db "errors.backup.${ts}.db" || echo "(errors.db not present yet — skipped)")
```

Then `ls -la *.backup.*.db` to confirm the files landed and report sizes + timestamp back to the user. `errors.db` may not exist on a fresh checkout — that's fine, skip it silently.

## When to use

- About to run any `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `CREATE TABLE`, `REPLACE`, `VACUUM` against either DB
- About to add a missing table
- Before changing column types or constraints
- Before any code change that runs DB writes on first launch

## When NOT to use

- Read-only `SELECT` queries — no need
- Inspecting schema via `sqlite_master` — no need
- Running the app normally — only IPC handlers + the errors store write, all driven by user actions or live error events

## Restore

If a change goes wrong, restore the most recent backup of the relevant file:

```bash
# loc_adm:
cd "d:/Client-Side_Project/ShortCut_Studio/src/src/db_files" && ls -t loc_adm.backup.*.db | head -1 | xargs -I {} cp {} loc_adm.db

# errors:
cd "d:/Client-Side_Project/ShortCut_Studio/src/src/db_files" && ls -t errors.backup.*.db | head -1 | xargs -I {} cp {} errors.db
```

**Confirm with the user before restoring** — this overwrites current state.

## Housekeeping

`*.db` is gitignored (see [.gitignore](../../../.gitignore)) so backups never get committed. They accumulate in `db_files/` though — periodically suggest pruning ones older than a week.
