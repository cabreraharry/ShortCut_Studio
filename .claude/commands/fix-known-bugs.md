---
description: Walk through the four documented bugs in src/src/index.js, propose fixes, and apply the ones the user approves. Backs up the DB first if any schema change is involved.
---

The four documented bugs (see [memory: project_known_bugs](../../memory/project_known_bugs.md) and [CLAUDE.md](../../CLAUDE.md#known-bugs--gotchas)):

1. **Missing `OCR_Process` table** — [src/src/index.js:185](../../src/src/index.js#L185) queries it; not in the DB.
2. **`getLastID` case mismatch** — [src/src/index.js:322](../../src/src/index.js#L322) checks `row.lastID` (lowercase), should be `LastID`.
3. **`childRow.id` lowercase** — [src/src/index.js:409](../../src/src/index.js#L409) uses `.id`, column is `ID`. Children-included cleanup runs with `undefined`.
4. **`API_Key VARCHAR(50)` truncation** — schema in `loc_adm.db`. Real OpenAI/Anthropic keys exceed 50 chars.

## How to run this command

For each bug, in order:

1. **Re-read the current code at the cited line** (don't trust the memory blindly — verify the bug is still present).
2. **State the bug in one sentence and the proposed fix in one sentence.**
3. **Ask the user**: fix now, skip, or defer? Don't auto-apply.
4. If the user says fix:
   - Bugs 2 and 3 are pure code edits — apply via `Edit`.
   - Bug 1 needs both a schema migration (`CREATE TABLE OCR_Process(...)`) and a confirmed shape — ask the user what columns the Progress tab actually expects (the renderer uses `OCR_Proc_ID`, `OCR_DocID`, `OCR_Proc_Data`, `OCR_Timing_sec`). Run the **db-backup** skill first.
   - Bug 4 needs an `ALTER TABLE LLM_Provider` (SQLite has limited ALTER — may need a temp table swap). Run **db-backup** first. Confirm the new column width with the user.
5. After each fix, hand off to the **code-reviewer** agent for a quick second look before moving on.

## Order of attack (recommended)

Do bugs 2 and 3 first — pure code, no DB risk, no review needed beyond the reviewer agent. Then 1, then 4. Don't bundle all four into one diff; one bug per edit so the reviewer can focus.

## Don't

- Don't apply all fixes silently in one pass — the user wants a per-bug decision.
- Don't skip db-backup before any DDL.
- Don't normalize file paths or "tidy up" surrounding code while you're in there. Surgical fixes only.
