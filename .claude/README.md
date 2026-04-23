# `.claude/` — Project-Local Claude Configuration

Custom agents, skills, slash commands, and rules that ship with this repo so anyone running Claude Code here picks them up automatically.

## Layout

```
.claude/
├── README.md          this file
├── rules.md           hard project rules (read by humans + linked from CLAUDE.md)
├── settings.json      tool permissions (allow/deny/ask) scoped to this project
├── agents/
│   ├── db-inspector.md     read-only SQLite inspector
│   ├── ipc-auditor.md      cross-references Electron IPC channels
│   ├── electron-runner.md  starts/stops the Electron app for manual smoke tests
│   └── code-reviewer.md    independent second-opinion review of a diff
├── skills/
│   ├── sqlite-query/SKILL.md   one-shot read-only SQL via better-sqlite3
│   ├── rebuild-native/SKILL.md `npx electron-rebuild` after Electron/Node bumps
│   ├── package-win/SKILL.md    `npm run build:win` with pre-flight checks
│   └── db-backup/SKILL.md      timestamped copy of loc_adm.db before any DML
└── commands/
    ├── dev.md             /dev             → start the app, tail logs
    ├── db.md              /db [SQL]        → inspect the SQLite DB
    └── audit-ipc.md       /audit-ipc       → run the ipc-auditor agent
```

## How to use

- **Agents** are invoked by Claude automatically when their `description` matches the task, or explicitly with the `Agent` tool's `subagent_type`.
- **Skills** are invoked via the `Skill` tool when the user's request matches.
- **Slash commands** are invoked by typing `/dev`, `/db`, `/audit-ipc` in chat.
- **`rules.md`** is non-negotiable. Read [rules.md](rules.md) before any change.
- **`settings.json`** scopes tool permissions to safe defaults for this repo.

## Why these specific tools

- This codebase has a **deeply nested `src/src/` layout** that's easy to misnavigate. The rules and agents pin all work to the right place.
- **SQLite is the source of truth** for every screen. A read-only inspector (`db-inspector` + `sqlite-query` skill + `/db`) gets traction faster than ad-hoc `node -e` calls every time.
- **Electron IPC silently no-ops on typos** — `ipc-auditor` catches drift between main / preload / renderer.
- **Native better-sqlite3 vs Electron's bundled Node ABI** is the single most common breakage; `rebuild-native` and `electron-runner` cover it.

## Adding new tools

- New agent: drop a `*.md` file in `agents/` with frontmatter `name`, `description`, `tools`, optional `model`.
- New skill: `skills/<name>/SKILL.md` with frontmatter `name`, `description`. Add helper scripts alongside.
- New slash command: `commands/<name>.md` with frontmatter `description` and optional `argument-hint`.
