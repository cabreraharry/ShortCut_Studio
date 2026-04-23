# 04 — Architecture

Deep technical tour of the codebase. Written so a new contributor can open the repo and understand the shape in 10 minutes.

## At-a-glance

- **Process split:** Electron Main ↔ Preload (contextBridge) ↔ Renderer (React SPA). Type-safe IPC via `.invoke`. No renderer touches disk or the DB directly.
- **Build tool:** `electron-vite` — handles main/preload/renderer as three Vite builds with shared watch mode during dev.
- **Data layer:** `better-sqlite3` against `db_files/loc_adm.db` (read + write, main only). Read-only access to SCL_Demo's mode-specific `SCLFolder_{Publ,Priv}.db` when present.
- **Background work:** Python PyInstaller `.exe`s spawned and supervised by the Electron main process. Workers expose `/health` + `/status` via a shared FastAPI wrapper module.
- **External integration:** `IExecEngineClient` interface + `MockExecEngineClient` impl. Future `RealExecEngineClient` will speak the Consumer Peer protocol when ExecEngine's HTTP layer lands.

## Repository layout (as built, absolute paths)

```
D:/Client-Side_Project/ElectronAdmin2/
├── .vscode/                              ← launch.json, tasks.json, settings.json, extensions.json
├── .claude/                              ← project-scoped Claude Code skills (db-backup, rebuild-native, …)
├── _Docu/                                ← design PDFs + screenshots from the owner
├── docs/claude-handoff/                  ← THIS FOLDER
├── src_orig/                             ← older pre-rewrite snapshot — DO NOT EDIT
├── db_files/, asset/                     ← top-level carry-over directories, mostly legacy
├── CLAUDE.md                             ← repo-root architecture guide
├── README.md
└── src/src/                              ← ACTIVE codebase
    ├── package.json                      npm scripts + deps
    ├── electron.vite.config.ts           main/preload/renderer Vite configs + aliases
    ├── tsconfig.{json,node.json,web.json}
    ├── tailwind.config.js
    ├── postcss.config.mjs
    ├── components.json                   shadcn/ui config
    ├── electron-builder.yml              NSIS installer config
    ├── resources/
    │   ├── icon.ico                      256×256+ (required by electron-builder)
    │   └── README.md
    ├── db_files/loc_adm.db               main SQLite DB (gitignored)
    ├── exe/                              LocalHostTools binaries (SCL_ListPorts.exe, …)
    ├── out/                              electron-vite build output (gitignored)
    ├── release-builds/                   electron-builder installer output (gitignored)
    │   ├── win-unpacked/ShortCut Studio.exe    smoke-test target
    │   └── ShortCut Studio-Setup-0.2.0.exe     NSIS installer
    └── src/
        ├── main/                         Electron main process (TypeScript)
        │   ├── index.ts                  entry: app.whenReady → init DB + IPC + workers + window + tray
        │   ├── window.ts                 BrowserWindow factory with ELECTRON_RENDERER_URL dev detection
        │   ├── tray.ts                   system tray + context menu
        │   ├── db/
        │   │   ├── connection.ts         better-sqlite3 wrapper (dev: local db_files, prod: userData)
        │   │   ├── migrations.ts         idempotent CREATE-TABLE-IF-NOT-EXISTS + seeds
        │   │   └── scl-folder.ts         read-only accessor for SCL_Demo's mode-specific DB
        │   ├── ipc/
        │   │   ├── index.ts              register all handlers at boot
        │   │   ├── app.ts                quit, openExternal, getVersion
        │   │   ├── mode.ts               Public/Private toggle state (in-memory, default 'publ')
        │   │   ├── folders.ts            Folder CRUD + file-picker
        │   │   ├── fileTypes.ts          FileTypeFilters CRUD
        │   │   ├── llm.ts                LLM_Provider / Models / test-connection
        │   │   ├── settings.ts           AdminData read/update
        │   │   ├── progress.ts           summary / jobs / history (via getExecEngine())
        │   │   ├── topics.ts             TopicsList (joins SCL_Demo DB + map table) / Generate / Review / Approve
        │   │   ├── superCategories.ts    CRUD + topic assignment
        │   │   ├── ipfs.ts               status / setAllocation (via getExecEngine())
        │   │   ├── privacy.ts            listTerms / updateTerms
        │   │   └── diagnostics.ts        workers / restart / tail-log
        │   ├── workers/
        │   │   ├── config.ts             SUPERVISED_WORKERS + resolveWorkersDir
        │   │   └── supervisor.ts         spawn, stdout/stderr capture, exit handling, exponential backoff, health-ping loop
        │   └── execengine/
        │       ├── client.ts             IExecEngineClient interface + getExecEngine() singleton
        │       └── mock.ts               MockExecEngineClient — deterministic synthetic data
        ├── preload/
        │   └── index.ts                  contextBridge.exposeInMainWorld('electronAPI', { … })
        ├── renderer/                     React app
        │   ├── index.html                Vite entry; has CSP meta
        │   ├── main.tsx                  ReactDOM.createRoot + QueryClient + HashRouter
        │   ├── App.tsx                   <AppShell><Routes>…</Routes></AppShell>
        │   ├── components/
        │   │   ├── ui/                   shadcn primitives (button, card, input, badge, dialog)
        │   │   └── layout/               AppShell, Sidebar, Header, InfoSection
        │   ├── features/                 one folder per sidebar route
        │   │   ├── dashboard/            DashboardPage + ProgressGlass + TimeRangeBar
        │   │   ├── folders/              FoldersPage
        │   │   ├── topics/               TopicsPage
        │   │   ├── llm/                  LlmPage + OnboardingDialog + provider-onboarding.ts (canned guides)
        │   │   ├── community/            CommunityPage
        │   │   ├── privacy/              PrivacyPage
        │   │   └── settings/             SettingsPage
        │   ├── lib/
        │   │   ├── utils.ts              cn (class-merge) + formatNumber
        │   │   └── api.ts                export const api = window.electronAPI
        │   └── styles/
        │       └── globals.css           @tailwind directives + shadcn CSS variables for light + dark
        └── shared/                       used by BOTH main and renderer via @shared path alias
            ├── ipc-channels.ts           channel-name constants (IpcChannel)
            ├── types.ts                  domain types (FolderRow, Job, ProgressSummary, etc.)
            └── api.ts                    ElectronAPI interface + global Window augmentation
```

## Process responsibilities

### Main process
- Window lifecycle + tray
- SQLite connection (long-lived)
- IPC handler registration
- Worker supervision (spawn / backoff / health-ping / log buffer)
- ExecEngine client singleton
- Schema migrations on boot

**Boots from `src/main/index.ts::bootstrap()`** — the sequence is:
1. `app.whenReady()`
2. `initDatabase()` (opens `loc_adm.db`, sets WAL + FK pragmas)
3. `runMigrations()` (idempotent CREATE TABLE + default seeds)
4. `registerIpcHandlers()` (all 11 domain handler files)
5. `startWorkerSupervisor()` (spawns long-running workers + starts health poll)
6. `createMainWindow()` + `createTray()`

Shutdown via `before-quit`: `stopAllWorkers()` then `closeDatabase()`.

### Preload
Single responsibility: expose a **typed, invoke-based** `window.electronAPI` via `contextBridge.exposeInMainWorld`. Shape is defined in `src/shared/api.ts::ElectronAPI`. No other bridge, no other globals.

### Renderer
Pure React SPA. Never imports `electron` or `node:*`. All side-effects go through `window.electronAPI` (via `import { api } from '@/lib/api'`). Data-fetching uses React Query; local UI state uses `useState` + Zustand when a store is warranted.

## IPC model

### Rules
1. Channel names come from `IpcChannel` constants in `src/shared/ipc-channels.ts`. **Never** hardcode a string.
2. Every channel has:
   - A handler in `src/main/ipc/<domain>.ts`
   - A wrapper method in `src/preload/index.ts` under `api.<domain>.<method>`
   - A typed method in `src/shared/api.ts` under `ElectronAPI.<domain>.<method>`
3. Use `ipcMain.handle` (async-aware) — not `ipcMain.on`. All calls are `ipcRenderer.invoke` round-trips.
4. Shared types live in `src/shared/types.ts`. Both main and renderer import from `@shared/*`.

### Example round-trip

`FoldersPage.tsx` → `api.folders.list()`:

```
Renderer:   api.folders.list()                            // @/lib/api re-exports window.electronAPI
            └── window.electronAPI.folders.list()
                  └── ipcRenderer.invoke(IpcChannel.FoldersList)

Main:       ipcMain.handle(IpcChannel.FoldersList, () => {
              const rows = db.prepare('SELECT * FROM Folder …').all()
              return rows.map(toFolderRow)   // returns FolderRow[]
            })

Renderer:   React Query caches it under ['folders']
```

## Data layer

### Databases

| File | Owner | Access | Purpose |
|---|---|---|---|
| `src/src/db_files/loc_adm.db` | ShortCut Studio | read+write (main process only) | admin config, LLM providers, OCR_Process, SuperCategories, etc. |
| `D:/Client-Side_Project/SCL_Demo/db_files/SCLFolder_Publ.db` | SCL_Demo's scanner | **read-only** from ShortCut Studio | public-mode scan data (Files, Folders, TopicNames, TopicFiles) |
| `D:/Client-Side_Project/SCL_Demo/db_files/SCLFolder_Priv.db` | SCL_Demo's scanner | **read-only** from ShortCut Studio | private-mode scan data |

### loc_adm.db schema (as migrations.ts creates it)

```
AdminData(RecID PK=1, Localhost_Port=44999, NumTopicThreshold=10, CPU_Perf_Threshold=50)
Folder(ID PK, Path TEXT, Include 'Y'|'N', ProcRound, LastUpd_CT)
LLM_Provider(Provider_ID PK, Provider_Name, Has_API_Key, API_Key TEXT, API_Host,
             IsDefault, Supported, AllowAddModel)
Models(ModelID PK, ProviderID FK, ModelName, ProviderDefault)
OCR_Process(JobID PK, Kind, Status, Label, StartedAt, FinishedAt,
            ProgressCurrent, ProgressTotal, Error)
SuperCategories(SuperCategoryID PK, Name UNIQUE)
TopicSuperCategoryMap(topicName TEXT PK, superCategoryId FK → SuperCategories ON DELETE CASCADE)
ProgressSnapshots(ts PK, cumulativeLocal, cumulativePeer)   -- populated in v1.5
PrivacyTerms(id PK, term UNIQUE, source 'system'|'user')
LLM_Usage(id PK, providerId, tokensIn, tokensOut, ts)       -- populated in v1.5
FileTypeFilters(extension TEXT PK, label, enabled 0|1, sortOrder)
```

### Conventions
- **Boolean-ish** fields on pre-existing tables remain `'Y'` / `'N'` strings for compatibility. New tables use modern types (INTEGER 0/1 or TEXT enums).
- **Foreign keys:** `foreign_keys = ON` pragma set at connect; new FK constraints work (e.g. TopicSuperCategoryMap's CASCADE).
- **WAL mode** enabled for better concurrent-read performance.
- **Migrations** are idempotent `CREATE TABLE IF NOT EXISTS` + data seeding guarded by row count — safe to run on every boot.

### User-data path resolution (production)
In dev, `loc_adm.db` lives in the repo at `src/src/db_files/loc_adm.db`. In a packaged build, `connection.ts::locAdmDbPath` uses `app.getPath('userData')/db_files/loc_adm.db` and copies the bundled seed (from `process.resourcesPath/db_files/loc_adm.db`) on first launch. Upgrades don't clobber user state.

## Worker supervisor

### What's supervised

Listed in `src/main/workers/config.ts::SUPERVISED_WORKERS`:

| Worker | Port | Auto-start | Args |
|---|---|---|---|
| `root_watchdog` | 19001 | ✓ | — |
| `topic_watchdog` | 19002 | ✓ | — |
| `gemini_processor` | 19003 | ✓ | `--incremental` |

One-shot workers (`filescanner`, `rescan`, `postprocessing`) are spawned on demand by their respective IPC handlers, not listed here.

### Executable resolution

`resolveWorkersDir()` checks, in order:
1. `process.env.SCL_WORKERS_DIR` (dev override)
2. `<resourcesPath>/workers/` (packaged build — after electron-builder copies them)
3. `D:/Client-Side_Project/SCL_Demo/_exe/` (default dev path)

### Lifecycle

For each configured worker:
1. `spawn` with `WORKER_HEALTH_PORT` env var injected
2. Capture stdout + stderr into a per-worker ring buffer (400 lines)
3. On exit with non-zero code, schedule restart with `2_000 * 2^n` ms backoff (capped at 30 s, max 5 attempts)
4. Every 10 s, `pingHealth` hits `http://127.0.0.1:<port>/health`
5. Worker process death (detected via `exit` event) is authoritative — `pingHealth` failure alone does NOT mark a worker crashed (the worker may simply not have adopted the FastAPI wrapper yet)

### FastAPI wrapper module

At `D:/Client-Side_Project/SCL_Demo/tools/worker_api.py`. Workers import and call `start_worker_api(default_port=N, default_status={...})` which spawns a daemon thread running FastAPI + uvicorn. Exposes `/health` (uptime) and `/status` (arbitrary JSON the worker updates via `set_status` / `update_status`). Integration guide at `SCL_Demo/tools/WORKER_API_INTEGRATION.md`.

## ExecEngine client pattern

### Interface contract
`src/main/execengine/client.ts` defines `IExecEngineClient`:

```ts
interface IExecEngineClient {
  getProgressSummary(range: TimeRange): Promise<ProgressSummary>
  getProgressHistory(range: TimeRange): Promise<ProgressHistoryPoint[]>
  listJobs(): Promise<Job[]>
  getIpfsStatus(): Promise<IpfsStatus>
  setIpfsAllocation(gb: number): Promise<void>
}
```

### v1 implementation (Mock)
`src/main/execengine/mock.ts` — `MockExecEngineClient`. Returns synthetic data that varies over time so the UI feels alive:
- Local processed counts grow linearly with elapsed time
- Peer counts follow a slow sine wave + linear baseline
- Jobs list is a fixed 3-job fixture
- IPFS status returns running=false, peerCount=0

### v2 plan
A `RealExecEngineClient` will implement the Consumer Peer protocol (CBR, CBRM, CDREQ, CSCT, etc.) against ExecEngine's Agent Hub. When the HTTP/FastAPI layer lands at `D:/ExecEngine/V2/server_V2/ah_V2/`, the only change needed here is:
1. Create `src/main/execengine/real.ts` with `RealExecEngineClient`
2. Swap `getExecEngine()` factory return based on a config flag (or env var)
3. Feature code stays untouched

## Renderer architecture

### Routing
HashRouter (not BrowserRouter) — Electron's `file://` scheme and React Router don't play nicely without hash. Routes defined in `App.tsx`.

### Styling
- Tailwind v3, utility-first
- shadcn/ui "new-york" style (see `components.json`)
- CSS variables for theme tokens (`--background`, `--primary`, etc.) — swap on `.dark` class
- **Dark mode default**: `<html class="dark">` in `index.html`; toggle adds/removes `.dark` class

### Data fetching
React Query everywhere. Most queries invalidate on mode change (triggered by `Header.tsx`'s `setMode` mutation calling `qc.invalidateQueries()` without a specific key).

Polling intervals:
- Progress summary + jobs: every 3 s
- IPFS status: every 5 s
- Worker statuses: every 5 s
- Folders / LLM / Topics / SuperCategories / FileTypes / Settings / Privacy: on-demand (no polling)

### Path aliases
- `@/*` → `src/renderer/*`
- `@shared/*` → `src/shared/*`
- `@main/*` → `src/main/*` (for main-process code only)

Configured in both `electron.vite.config.ts` (runtime) and `tsconfig.web.json` / `tsconfig.node.json` (type-check).

## Security posture

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: false` (main process needs native modules via preload — sandbox true would block better-sqlite3)
- CSP in `renderer/index.html`: `default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data: blob:; font-src 'self' data:`
- No `require('electron')` in renderer — Electron's module system is blocked by context isolation
- External URLs open via `shell.openExternal`, never `window.open` (blocked by `setWindowOpenHandler`)
