# Claude session handoff — SCL Admin unified rewrite

**Purpose of this folder.** Catch-up material for any future Claude Code (or Claude Chat / Claude API / VS Code Claude extension) session that opens this repo. The original rewrite work was done in a terminal Claude Code session that isn't visible from VS Code's Claude-extension history. These docs capture all of it.

**Date of the session:** 2026-04-20 (Asia/Manila, ~14:00–16:30 local).
**Session participants:** Harry Cabrera (client-side engineer) + Claude Opus 4.7 (1M context).

## Read in this order

1. **[01-conversation-log.md](01-conversation-log.md)** — Chronological summary of the session: what was asked, what was explored, what was decided. Read this first to understand why things were built the way they were.

2. **[02-approved-plan.md](02-approved-plan.md)** — The full implementation plan the user approved before work began. Verbatim copy of `C:/Users/harrycabrera/.claude/plans/okay-here-are-the-dapper-clarke.md`.

3. **[03-key-decisions.md](03-key-decisions.md)** — Every meaningful decision (tech, scope, product) with the rationale that drove it. Use this to judge edge cases instead of re-litigating.

4. **[04-architecture.md](04-architecture.md)** — How the code is organised: process split, IPC, DB, worker supervisor, ExecEngine client pattern. Most useful when reading code for the first time.

5. **[05-features-built.md](05-features-built.md)** — Per-feature status of what's real vs. stubbed. Cross-references the files that implement each feature.

6. **[06-pending-and-caveats.md](06-pending-and-caveats.md)** — Known gaps, stubs, watch-items, and scope reserved for v1.5 / v2. Critical reading before adding new features.

7. **[07-how-to-continue.md](07-how-to-continue.md)** — Dev commands, VS Code workflow, available Claude Code skills, conventions, next steps.

## Quick facts

- **Plan file (outside repo):** `C:/Users/harrycabrera/.claude/plans/okay-here-are-the-dapper-clarke.md`
- **Persistent memory files (outside repo):** `C:/Users/harrycabrera/.claude/projects/D--Client-Side-Project/memory/`
  - `user_role.md`, `project_scl_admin.md`, `feedback_inplace_rewrites.md`, `reference_execengine.md`, `project_scl_demo_independence.md`
  - Plus pre-existing: `workspace_overview.md`, `services_and_ports.md`, `known_gotchas.md`, `pipeline_error_idiom.md`
- **Top-level CLAUDE.md** at the repo root is up to date with the new stack — read it too.
- **Owner's original brief:** `C:/Users/harrycabrera/OneDrive/Documents/UI_UX_For_SCL_Admin_Prompt_EW_26_04_18.docx` (content summarised in [01-conversation-log.md](01-conversation-log.md)).

## Git history landmarks

| SHA | Meaning |
|---|---|
| `52211f8` | Initial commit — pre-rewrite Bootstrap/jQuery app |
| `0fbc0b4` | Safety snapshot committing outstanding .claude config + .exe changes before demolition |
| `61b18f7` | **Full in-place rewrite** — deletes old renderer/main, lays down React+Vite+TS+Tailwind+shadcn, scaffolds every route |
| `5600a32` | **All v1 features** — Folders, LLM, Topics, Progress Glass, Community, Privacy, Settings |
| `e3b0690` | NSIS installer pipeline + 256×256 icon + refreshed Claude skills |
| `1ff7475` | `.vscode/` workspace config (launch.json, tasks.json, settings.json, extensions.json) |

## If you're a new Claude session: minimum context to absorb

Read, in order: this file → `01-conversation-log.md` → `03-key-decisions.md` → the repo-root `CLAUDE.md`. That's enough to start contributing without blowing up assumptions. Then grab `04-architecture.md` or `06-pending-and-caveats.md` as needed when you hit a specific question.
