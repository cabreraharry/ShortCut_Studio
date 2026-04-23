# 07 — How to continue

Operational guide for picking up where this session left off. Commands, workflow, conventions, and concrete next steps.

## Dev workflow

### First-time setup (on a new machine)

```bash
cd "D:/Client-Side_Project/ElectronAdmin2/src/src"
npm install                           # ~1 min — includes auto electron-rebuild for better-sqlite3
```

### Daily loop

```bash
cd "D:/Client-Side_Project/ElectronAdmin2/src/src"
npm run dev                            # Vite HMR + Electron hot-reload; Ctrl+C to stop
```

Or from VS Code: `F5` (runs the "Dev (electron-vite)" launch config) or `Ctrl+Shift+P → Tasks: Run Task → dev`.

### Full verification (before pushing)

```bash
npm run typecheck    # both node and web tsconfigs
npm run build        # produces out/main, out/preload, out/renderer
npm run build:win    # full NSIS installer — 2-5 min — run before a release
```

### Smoke-test the packaged app

Double-click `release-builds/win-unpacked/ShortCut Studio.exe` after `npm run build:win`. Faster than re-installing.

### If `better_sqlite3.node` errors on launch

```bash
npx electron-rebuild -f -w better-sqlite3
```

Or use the `rebuild-native` project skill.

## VS Code setup

`.vscode/` is force-committed with:

- **launch.json** — `F5` launches the dev build. There's also a "Smoke-test packaged app" config.
- **tasks.json** — `Ctrl+Shift+B` runs `dev` (the default build task). Task menu (`Ctrl+Shift+P → Tasks: Run Task`) includes: `dev`, `typecheck`, `build`, `build:win (installer)`, `rebuild better-sqlite3`.
- **settings.json** — excludes `node_modules/`, `out/`, `release-builds/win-unpacked/`, `*.tsbuildinfo` from search and file tree. Points TypeScript at the project's workspace TS version. Tailwind IntelliSense class-regexes for `cva()` and `cn()`.
- **extensions.json** — recommends ESLint, Tailwind CSS IntelliSense, Prettier, TypeScript Next, GitLens.

### Opening the folder

Open `D:/Client-Side_Project/ElectronAdmin2/` as the workspace root. The Explorer should show the top-level files (CLAUDE.md, README.md, .claude/, src/, docs/, etc.). Your actual work happens under `src/src/`.

If VS Code Explorer shows stale pre-rewrite files (index.html, renderer.js, etc.), `Ctrl+Shift+P → File: Refresh Explorer`. Those files are gone — git is clean.

## Project-scoped Claude Code skills

Located at `.claude/skills/`. Each wraps a common multi-step command safely:

| Skill | Use for |
|---|---|
| `db-backup` | Timestamped copy of `loc_adm.db` BEFORE any destructive change |
| `rebuild-native` | Fix `better_sqlite3` ABI-mismatch errors |
| `sqlite-query` | Read-only SQL helper — pass the SELECT as the argument |
| `package-win` | Wraps `npm run build:win` — produces installer + confirms with user first |

Invoke via the Skill tool in a Claude Code session. The Claude-extension chat in VS Code uses the same skill definitions if you open this repo as the workspace.

## Coding conventions (what to do / not to do)

### Import paths — use aliases
- `@/*` → `src/renderer/*`
- `@shared/*` → `src/shared/*`
- `@main/*` → `src/main/*` (main-process only)

### File organization
- **One IPC handler file per domain** at `src/main/ipc/<domain>.ts`. Registered from `src/main/ipc/index.ts`.
- **One feature folder per route** at `src/renderer/features/<name>/<Name>Page.tsx`. Extra components for that feature live in the same folder.
- **shadcn/ui primitives** at `src/renderer/components/ui/`. Add new ones via `npx shadcn@latest add <name>` — it'll read `components.json`.
- **Layout components** (Sidebar, Header, InfoSection, AppShell) at `src/renderer/components/layout/`.
- **Types used by both main and renderer** go in `src/shared/types.ts`. IPC channel constants in `src/shared/ipc-channels.ts`. `ElectronAPI` interface in `src/shared/api.ts`.

### IPC channels
- Add channel name to `IpcChannel` in `src/shared/ipc-channels.ts`.
- Add handler method to `ElectronAPI` in `src/shared/api.ts`.
- Register handler in `src/main/ipc/<domain>.ts` via `ipcMain.handle(IpcChannel.X, …)`. Return a value or `void`.
- Add wrapper in `src/preload/index.ts`: `ipcRenderer.invoke(IpcChannel.X, ...args)`.
- Register the `register<Domain>Handlers()` function from `src/main/ipc/index.ts`.

### Data fetching
- **Use React Query** for everything that comes from `window.electronAPI`. Keys should be stable arrays.
- **Mutations** invalidate their own key on success; `useQueryClient().invalidateQueries({ queryKey: [...] })`.
- **Polling** via `refetchInterval` is fine for local-only data (progress, jobs, workers).

### Styles
- Tailwind utility classes as the primary styling mechanism.
- `cn(...)` helper (from `@/lib/utils`) for conditional / merged class lists.
- CSS variables (`hsl(var(--primary))`) for theme tokens — defined in `src/renderer/styles/globals.css`. Two palettes: root (light) + `.dark`.
- `.dark` class on `<html>` is the theme toggle. Set in `index.html`, flipped by the Header.

### TypeScript
- `strict: true` everywhere. `noUnusedLocals` + `noUnusedParameters` are on — TS will complain about dead imports.
- Type IPC results at the `@shared/types` level, then let handlers / preload / renderer inherit.
- `asChild` Slot pattern from Radix is used for shadcn Button when you need a link-styled-as-button.

## Git workflow

- **Branch:** `main` (no feature branches needed for solo dev).
- **Commits** are tagged with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` when Claude wrote them.
- **Don't commit `*.db` files** — gitignored.
- **Don't commit `out/`, `release-builds/`, `node_modules/`** — gitignored.
- `.vscode/` is gitignored at the repo root but specific files are force-added. Use `git add -f .vscode/<new-file>` for new shared config.

## Memory files (persistent across sessions)

At `C:/Users/harrycabrera/.claude/projects/D--Client-Side-Project/memory/`. Automatically available to future Claude Code sessions that open this working directory.

Current files:
- **user_role.md** — Harry is client-side only; separate owner runs ExecEngine + product vision
- **project_scl_admin.md** — active rewrite, tech stack, phases
- **feedback_inplace_rewrites.md** — prefer in-place rewrites over parallel new projects when existing scaffolding is reusable
- **reference_execengine.md** — backend location + integration status
- **project_scl_demo_independence.md** — SCL_Demo does not currently talk to ExecEngine
- **workspace_overview.md, services_and_ports.md, known_gotchas.md, pipeline_error_idiom.md** — pre-existing from earlier sessions

Index at `MEMORY.md`. Update it whenever you add/remove a file.

## Recommended next-work chunks

In roughly-priority order:

### Immediate (unblock core workflows)
1. **Adopt worker_api.py in root_watchdog / topic_watchdog / gemini_processor**. 3-line change per worker + rebuild `.exe`. Result: Diagnostics panel shows live statuses, scan/topic jobs appear on the Dashboard for real.
2. **Bundle workers into installer**. Second `extraResources` entry in `electron-builder.yml`; ensure `resolveWorkersDir` picks up `resourcesPath/workers/`.
3. **Wire gemini_processor to consume OCR_Process rows**. When `TopicsGenerate` inserts a row, the processor picks it up and runs Gemini on the folder.
4. **Materialize .lnk shortcuts on topic approval**. Currently `TopicsApprove` is a stub.

### Short-term (user-visible polish)
5. **Movable folders**. Settings → Move… → filesystem copy + config update + restart prompt.
6. **Sidebar collapse-to-icons**. Small UX win.
7. **Draggable info-section divider**. Currently two-state snap; make it free-drag with persisted height.
8. **Real drive picker** in Community. OS drive enumeration via `electron.os.networkInterfaces` equivalents.

### Medium-term (v1.5 scope)
9. **Content-based classification**. New `Files.DocCategory` column. Classifier behind a `/classify` IPC handler that routes to the selected LLM.
10. **Progress history line chart**. Populate `ProgressSnapshots` every 4 h; render via a recharts line chart when TimeRange=All.
11. **LLM usage instrumentation**. Every LLM call increments tokens in `LLM_Usage`; Settings page grows a usage card.
12. **Info Section real content**. Move placeholder messages to `resources/info-messages.json`; owner fills in the 15-25 messages.
13. **Auto-update activation**. Set `publish.url` in `electron-builder.yml` to a real GitHub Releases URL (or custom server); run `electron-updater` on app start.

### Long-term (v2 scope)
14. **RealExecEngineClient** against ExecEngine's FastAPI layer (when it ships).
15. **Full manual topic CRUD**.
16. **Custom rules engine** for content detection.

## For a fresh Claude session starting from this repo

1. Open this repo as the workspace in whatever Claude surface you're using (VS Code extension / Claude Code CLI / Claude.ai with a repo connection).
2. Read, in this order:
   - `docs/claude-handoff/README.md`
   - `docs/claude-handoff/01-conversation-log.md`
   - `docs/claude-handoff/03-key-decisions.md`
   - Repo-root `CLAUDE.md`
3. Look at what memory files are loaded — they should appear in system reminders when you open the folder.
4. Run `git log --oneline -10` to confirm the commit landscape matches the "Git history landmarks" section of the README.
5. Check `npm run typecheck && npm run build` work — if they don't, stop and investigate before doing anything else.
6. Identify which task from "Recommended next-work chunks" the user wants. Ask if unclear.

That's it. You should be able to pick up contributions with full context.
