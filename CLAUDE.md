# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## 📘 New session? Start here

Comprehensive handoff material from the 2026-04-20 rewrite session lives at **[docs/claude-handoff/](docs/claude-handoff/README.md)**. If you're a fresh Claude session (or a new human collaborator) opening this repo for the first time, read those docs first — they capture every decision, feature state, and watch-item so you don't re-litigate.

Minimum reading order: `docs/claude-handoff/README.md` → `01-conversation-log.md` → `03-key-decisions.md` → this file.

## Project Overview

**ShortCut Studio** — the unified client-side UI for the SCL document-processing ecosystem. A Windows-first Electron desktop app that gives researchers / academics one place to:

- Pick which folders to scan for eBooks (PDF, EPUB, MOBI)
- Configure LLM providers and API keys (Ollama, OpenAI, Claude, Gemini, HuggingFace, LM Studio)
- Browse topics + trigger topic generation + review AI suggestions
- Monitor progress (local + community peers) via the **Progress Glass**
- Manage IPFS allocation for peer-shared processing *(stubbed in v1)*
- Maintain a list of private terms that route matching files to the Private DB
- Diagnose background workers when something breaks

Stack: Electron + Vite + React 18 + TypeScript + Tailwind + shadcn/ui. The Bootstrap+jQuery predecessor (`ElectronAdmin2`) was deleted in the 2026-04-23 cleanup. The repo is hosted at https://github.com/cabreraharry/ShortCut_Studio and cloned locally as `ShortCut_Studio/`. The npm package name is `shortcut-studio`, the Electron `productName` is `ShortCut Studio`, and the Windows installer ships as `ShortCut Studio-Setup-<ver>.exe`.

**Approved plan:** `C:/Users/harrycabrera/.claude/plans/okay-here-are-the-dapper-clarke.md`.

## Repository Layout

All active work happens in `src/src/` (legacy nested folder — kept so existing Claude Code skills + VS Code tasks keep working without reconfiguration).

```
ShortCut_Studio/
├── src/
│   └── src/                        <-- ACTIVE codebase
│       ├── package.json            electron-vite + deps
│       ├── electron.vite.config.ts build config (main/preload/renderer)
│       ├── tsconfig.json           refs tsconfig.node.json + tsconfig.web.json
│       ├── tailwind.config.js
│       ├── components.json         shadcn/ui config
│       ├── electron-builder.yml    NSIS installer config (productName: ShortCut Studio)
│       ├── resources/
│       │   ├── icon.ico            app + tray icon (256×256 multi-res)
│       │   └── info-messages.json  Info Section content (TODO: owner supplies)
│       ├── db_files/
│       │   └── loc_adm.db          SQLite admin DB (gitignored)
│       ├── exe/                    SCL_Restart_PortIDs.exe + friends (spawned on boot)
│       ├── release-builds/         electron-builder output (gitignored)
│       ├── scripts/
│       │   └── storybook.ts        Playwright-driven page screenshotter → storybook/
│       ├── storybook/              Generated UX storybook (md + screenshots) for AI feedback loop
│       └── src/
│           ├── main/               Electron main process
│           │   ├── index.ts        entry: whenReady → init DB + handlers + window + tray
│           │   ├── window.ts       BrowserWindow + hide-on-close (tray-resident)
│           │   ├── tray.ts         system tray (guarded with isDestroyed checks)
│           │   ├── db/             better-sqlite3 connection + migrations
│           │   ├── ipc/            one file per domain: folders, llm, topics, progress,
│           │   │                   ipfs, privacy, diagnostics, settings, mode, app,
│           │   │                   filters, insights, knowledgeMap, drives, dataSource, system
│           │   ├── filters/        rule engine + provider adapters (Ollama, OpenAI, Claude,
│           │   │                   Gemini, clipboard, http-json, mock)
│           │   ├── mock/           seed/synthetic data for stubs
│           │   ├── os/             drives, fs-preview, local-tools (Windows shell helpers)
│           │   ├── workers/        supervisor (spawn/restart SCL_Demo .exes)
│           │   └── execengine/     client.ts (IExecEngineClient) + mock.ts / real.ts
│           ├── preload/
│           │   └── index.ts        contextBridge exposing typed ElectronAPI
│           ├── renderer/           React app
│           │   ├── index.html      Vite entry
│           │   ├── main.tsx        React root + QueryClient + HashRouter
│           │   ├── App.tsx         routes
│           │   ├── components/
│           │   │   ├── ui/         shadcn primitives (Button, Card, Toast, Tooltip, …)
│           │   │   ├── layout/     AppShell, Sidebar, Header, InfoSection, AboutDialog
│           │   │   ├── visual/     Hero, ColorfulStat, PeerNetwork, AllocationDisc, Burst,
│           │   │   │               WorkerConstellation, ProviderHub, PrivacyShield, etc.
│           │   │   └── drive-tree/ DriveTree (folder picker)
│           │   ├── features/       one folder per sidebar section
│           │   │   ├── dashboard/  + DedupCard, HoursSavedCard, ProgressGlass, TimeRangeBar
│           │   │   ├── folders/
│           │   │   ├── topics/     + TopicDistributionChart
│           │   │   ├── insights/
│           │   │   ├── knowledge-map/
│           │   │   ├── filters/    rule builder + classify dialog + presets
│           │   │   ├── llm/
│           │   │   ├── community/
│           │   │   ├── privacy/
│           │   │   └── settings/
│           │   ├── lib/            cn util, api wrapper, app-info, mutation-toast
│           │   ├── hooks/          use-count-up, use-debounced-value, use-row-selection, use-toast
│           │   ├── stores/         Zustand
│           │   └── styles/
│           │       └── globals.css Tailwind + shadcn CSS vars, dark default
│           └── shared/             used by BOTH main and renderer
│               ├── ipc-channels.ts channel name constants
│               ├── types.ts        domain types
│               └── api.ts          ElectronAPI interface (declares window.electronAPI)
├── _Docu/                          design PDFs + screenshots (owner-supplied)
├── docs/claude-handoff/            session-handoff narrative for new Claude/human collaborators
├── .claude/                        project-scoped agents / skills / commands
└── README.md
```

**Treat `src/src/` as the project root.** The pre-rewrite Bootstrap+jQuery codebase + `src_orig/` snapshot were deleted in the 2026-04-23 cleanup; if you need historical reference, check `git log` rather than assuming a sibling folder.

## Run / Build / Package

All commands run from `src/src/`:

```sh
npm install                # installs deps, runs electron-builder install-app-deps (rebuilds better-sqlite3 for Electron)
npm run dev                # electron-vite dev — HMR for renderer, watch-rebuild for main/preload
npm run typecheck          # both node + web TS projects
npm run build              # electron-vite build → out/
npm run build:win          # build + electron-builder --win (NSIS installer → release-builds/)
npm test                   # vitest (unit)
npm run test:e2e           # playwright (E2E against packaged-in-dir build)
```

If `better-sqlite3` errors with "was compiled against a different Node.js version" on first run:

```sh
npx electron-rebuild
```

## Architecture

### Process split

- **Main** (`src/main/`) owns the SQLite connection, IPC handlers, worker supervision, tray, window lifecycle. Everything that touches the OS lives here.
- **Preload** (`src/preload/index.ts`) — context-isolated bridge. Exposes one object, `window.electronAPI`, typed by `@shared/api`. No raw `ipcRenderer` leaks to the renderer.
- **Renderer** (`src/renderer/`) — React SPA. Never imports `electron`, never hits sqlite3 or the FS. All I/O goes via `window.electronAPI`, wrapped in React Query hooks.

Security: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: false`, strict CSP in `renderer/index.html`. Keep it that way.

### IPC model

- All calls use `ipcRenderer.invoke` (promise-based), not the legacy `.send` + `.on` one-way pattern.
- Channel names are **constants** in `src/shared/ipc-channels.ts` — never hardcode strings.
- Request/response shapes live in `src/shared/types.ts`; the full surface is typed via `ElectronAPI` in `src/shared/api.ts`.
- Handlers are registered once at startup from `src/main/ipc/index.ts`.

### ExecEngine integration

The Electron client's job is to **become the Consumer Peer** for the ExecEngine backend at `D:/ExecEngine/`. ExecEngine's HTTP consumer layer is **not yet implemented** (only internal TCP QUEUE works). The client depends on the `IExecEngineClient` interface (`src/main/execengine/client.ts`).

As of 2026-04-28, the factory returns `RealLocalExecEngineClient` (`src/main/execengine/realLocal.ts`) — a hybrid that:
- Reads real `totalFiles` / `processedLocal` from `SCLFolder_{Publ,Priv}.db` for `getProgressSummary`
- Delegates everything else (peer counts, IPFS, network summary, topics review/distribution, jobs list) to a private `MockExecEngineClient`

Real CP-protocol wiring of the remaining methods lands in v2 once ExecEngine ships its FastAPI/Nginx layer.

### Workers

Background processing (scan, watchdog, topic generation) lives in **SCL_Demo** (`D:/Client-Side_Project/SCL_Demo/`) as PyInstaller `.exes`:
`filescanner`, `rescan`, `root_watchdog`, `topic_watchdog`, `gemini_processor`, `postprocessing`.

The Electron main process's `workers/supervisor.ts` spawns + supervises these. Each `.exe` exposes a small FastAPI HTTP interface (via the shared `SCL_Demo/tools/worker_api.py` module) on a localhost port from the `WORKER_HEALTH_PORT` env var so the main process can query `/health` + `/status` instead of parsing stdout.

**LLM bridge (added v0.4.0):** [src/main/llm/bridgeServer.ts](src/src/src/main/llm/bridgeServer.ts) starts a loopback HTTP server on `127.0.0.1:45123` exposing `POST /llm/complete`. The supervisor passes `ELECTRON_LLM_BRIDGE_PORT=45123` in spawned workers' env. Workers POST chat-completion requests via [SCL_Demo/tools/electron_llm_client.py](D:/Client-Side_Project/SCL_Demo/tools/electron_llm_client.py); the bridge wraps the existing `complete()` dispatcher so workers always use whichever provider the user has selected in the GUI. No API keys in worker process memory.

**Packaged-mode data root:** the supervisor also sets `SCL_DEMO_DATA_ROOT=<userData>/scl_data` for spawned workers in packaged builds. The bundled `resources/scl_data_seed/db_files/` is copied to that location on first launch (see `db/scl-folder.ts::seedDataRootIfNeeded`). The Python workers' resolver short-circuits to that env var instead of walking up from `sys.executable` looking for an ancestor `db_files/` (which doesn't exist in the install layout).

Auto-restart on crash with backoff; visible in the **Diagnostics** panel in Settings.

### SQLite schema (`db_files/loc_adm.db`)

Migrations run idempotently on boot (`src/main/db/migrations.ts`). Core tables:

```sql
AdminData(RecID PK=1, Localhost_Port=44999, NumTopicThreshold=10, CPU_Perf_Threshold=50)
Folder(ID PK, Path TEXT, Include 'Y'|'N', ProcRound, LastUpd_CT)
LLM_Provider(Provider_ID PK, Provider_Name, Has_API_Key, API_Key TEXT, API_Host,
             IsDefault 'Y'|'N', Supported 'Y'|'N', AllowAddModel 'Y'|'N')
Models(ModelID PK, ProviderID FK, ModelName, ProviderDefault 'Y'|'N')
OCR_Process(JobID PK, Kind, Status, Label, StartedAt, FinishedAt,
            ProgressCurrent, ProgressTotal, Error)
SuperCategories(SuperCategoryID PK, Name UNIQUE)
ProgressSnapshots(ts PK, cumulativeLocal, cumulativePeer)
PrivacyTerms(id PK, term UNIQUE, source 'system'|'user')
LLM_Usage(id PK, providerId, tokensIn, tokensOut, ts)
```

Conventions: boolean-ish fields remain `VARCHAR` holding `'Y'` / `'N'` (carried over for compatibility). New tables use modern types. `IsDefault` / `ProviderDefault` still toggled with `CASE WHEN ... THEN 'Y' ELSE 'N' END` so exactly one row wins.

**Never expose sqlite3 to the renderer.** All reads/writes flow through IPC handlers.

Pre-seeded LLM providers: Ollama (default, local), OpenAI, Claude, Gemini, HuggingFace, LM Studio (local). HuggingFace + LM Studio added in v0.4.0; the `LLM_Budgets` table from a brief mid-development experiment is dropped on migration. The single source of truth for "is this provider local?" is [@shared/providers.ts::LOCAL_PROVIDER_NAMES](src/src/src/shared/providers.ts) — used by both the dispatcher's no-key-required exemption and the renderer's "Local" badge.

### Public / Private mode

A single `DbMode` ('publ' | 'priv') lives in the main process (`src/main/ipc/mode.ts`), toggled from the header. Views that care about mode refetch when it flips — React Query handles this via the `['mode']` key invalidation in `Header.tsx`. The actual per-mode DB (`SCLFolder_Publ.db` / `SCLFolder_Priv.db`) is SCL_Demo's — touched only through IPC handlers that route to the right connection.

## Coding Conventions

- **TypeScript everywhere.** Strict mode. No `any` without comment.
- **React 18**, function components + hooks. No class components.
- **Tailwind v3** utility-first. `cn(...)` helper from `@/lib/utils` for conditional classes.
- **shadcn/ui** primitives live in `src/renderer/components/ui/`. Add new ones via `npx shadcn@latest add <name>` (reads `components.json`).
- **Path aliases:** `@/` → `src/renderer/`, `@shared/` → `src/shared/`, `@main/` → `src/main/`. Use them; no `../../../`.
- **IPC channels:** always import from `@shared/ipc-channels`; never hardcode strings.
- **IPC handler files** live in `src/main/ipc/<domain>.ts` and export a `register<Domain>Handlers()` function called from `src/main/ipc/index.ts`.
- **Renderer data-fetching:** React Query. No raw `useEffect` + `useState` for async data.
- **No `require('electron')` in the renderer.** Use `window.electronAPI`.
- **Windows paths** in user-facing config (`C:\...`). Don't normalize aggressively.
- **Status flags** are `'Y'` / `'N'` strings on the existing tables. New tables use text enums or booleans.
- **Dark mode is default.** `<html class="dark">` ships set; toggle adds/removes `.dark`.

## Skills + Slash Commands

Project-scoped skills/commands live in `.claude/`. Known working ones (after rewrite):
- `db-backup` — copies `loc_adm.db` to a timestamped backup. **Run before any destructive DB change.**
- `rebuild-native` — re-runs `npx electron-rebuild` for better-sqlite3 after a node/electron upgrade.
- `sqlite-query` — read-only SELECT runner against `loc_adm.db`.
- `package-win` — triggers `npm run build:win`.

Skills whose shell commands are stale (reference the old `index.js` / `jquery` structure) get updated alongside the next related code task.

## Known Gotchas / Watch Items

When touching these, fix the root rather than working around it:

1. **`better-sqlite3` is native.** After any Electron version bump, `npx electron-rebuild`. `postinstall` handles this on fresh installs.
2. **Existing `loc_adm.db` was seeded with VARCHAR(50) columns** — migrations don't change stored rows, just add missing tables. SQLite treats VARCHAR as TEXT at runtime, so practical width is unlimited; the constraint is cosmetic.
3. **Info Section messages are placeholders** until the owner supplies real copy. Stored in `resources/info-messages.json` when that lands — for now inlined in `InfoSection.tsx`.
4. **Progress Glass peer data is synthetic** — `RealLocalExecEngineClient` reads real local counts from SCLFolder, but peer counts stay 0 (and range deltas/ETA stay synthetic) until ExecEngine's HTTP layer ships. Swap point: `realLocal.ts::getProgressSummary`.
5. **Worker .exes now build and run.** As of 2026-04-29, all three (`root_watchdog`, `topic_watchdog`, `gemini_processor`) build cleanly and serve `/health` + `/status` on ports 19001/19002/19003. SCL_Demo's `.venv` had a `psutil` gap (since fixed) and the bundled .exes had a runtime path-resolution bug (since fixed via `tools/utils_paths.py` resolver + frozen-detect). See `docs/claude-handoff/06-pending-and-caveats.md` item 1 for the full story.
6. **Insights / Folder Health / Knowledge Map / Filters preview are now REAL** (was 100% mock until 2026-04-28). All read from `SCLFolder_{Publ,Priv}.db` via `src/main/db/scl-folder.ts`. Empty / zero fallbacks when no scan has run.
7. **LLM model auto-discovery + auth-validating test-connection** (added 2026-04-28). New IPC channel `llm:discover-models` calls `Ollama /api/tags`, `OpenAI /v1/models`, `Claude /v1/models`, `Gemini /v1beta/models`, plus (added 2026-04-29) `HuggingFace whoami-v2 + curated fallback list`, `LM Studio /v1/models`. `LlmTestConnection` is a thin wrapper around discovery — auth-passes-iff-discovery-succeeds.

8. **LLM bridge for Python workers** (added 2026-04-29 in v0.4.0). [src/main/llm/bridgeServer.ts](src/src/src/main/llm/bridgeServer.ts) starts a loopback HTTP server on `127.0.0.1:45123` that exposes `POST /llm/complete` — a thin wrapper around the existing `complete()` dispatcher. SCL_Demo's `gemini_processor` worker no longer holds Gemini-specific credentials; it POSTs chat-completion requests to the bridge via [SCL_Demo/tools/electron_llm_client.py](D:/Client-Side_Project/SCL_Demo/tools/electron_llm_client.py). The supervisor passes `ELECTRON_LLM_BRIDGE_PORT=45123` in the spawned worker's env. The user's GUI provider choice now actually drives scan-time topic naming.

9. **Per-provider "Open usage dashboard" links + OpenAI inline spend** (replaced the brief soft-warn budget feature, 2026-04-29). Each cloud-provider card on the LLMs page has an "Open usage dashboard" button that opens the provider's billing page via `app.openExternal`. OpenAI's card additionally shows today's USD spend inline by hitting `/v1/usage` (undocumented but functional; defensive parsing; hides on any error). The earlier `LLM_Budgets` table is dropped on migration.

10. **Packaged-mode worker data root** (added 2026-04-29 in v0.4.0). The supervisor sets `SCL_DEMO_DATA_ROOT=<userData>/scl_data` for spawned workers in packaged builds. The bundled `resources/scl_data_seed/db_files/` is copied to that location on first launch by [scl-folder.ts::seedDataRootIfNeeded](src/src/src/main/db/scl-folder.ts). v0.3.x users get a one-time migration from the old `<userData>/scl_db_files/` layout.

11. **Installer bundles IPFS Kubo + Nginx** (added 2026-04-29 in v0.4.0). Vendored under `src/src/vendor/{ipfs,nginx}/` (gitignored, fetched by [scripts/fetch-vendor-binaries.mjs](src/src/scripts/fetch-vendor-binaries.mjs) on `build:win`/`build:unpack`). Lands at `resources/extras/{ipfs,nginx}/` in the installed app. Currently dormant — IPFS allocation feature and ExecEngine HTTP/Nginx layer ship in v2.

## Working with This Repo

- **Always edit in `src/src/`.** No other code-bearing folder exists post-cleanup.
- **The plan file** is the source of truth for what ships in v1. Update it if scope changes.
- **Memory files** live at `C:/Users/harrycabrera/.claude/projects/D--Client-Side-Project/memory/` and persist across sessions.
- **Don't commit `*.db`** (gitignored). Schema changes in `migrations.ts` ARE committed.
- **Windows-only assumptions** are baked in (`.exe` workers, `taskkill`, NSIS). Don't attempt cross-platform without explicit ask.

## Useful Reference Files

- [src/src/package.json](src/src/package.json) — scripts + deps
- [src/src/electron.vite.config.ts](src/src/electron.vite.config.ts) — build pipeline
- [src/src/src/shared/api.ts](src/src/src/shared/api.ts) — full IPC surface typed
- [src/src/src/main/ipc/index.ts](src/src/src/main/ipc/index.ts) — handler registration
- [src/src/src/renderer/App.tsx](src/src/src/renderer/App.tsx) — route config
- [_Docu/](_Docu/) — design PDFs + screenshots (owner-supplied)
