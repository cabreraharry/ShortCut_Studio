# ShortCut Studio — Architecture

A complete reference of the ShortCut Studio Electron client as of **2026-04-28**. Self-contained: a colleague who has never seen the codebase should be able to read this end-to-end and understand the shape of the app, every subsystem, and what is real vs. mocked.

---

## Table of Contents

1. [What it is](#1-what-it-is)
2. [Tech stack](#2-tech-stack)
3. [Process architecture](#3-process-architecture)
4. [Repository layout](#4-repository-layout)
5. [Boot sequence](#5-boot-sequence)
6. [Data layer](#6-data-layer)
7. [IPC surface](#7-ipc-surface)
8. [Feature pages (renderer)](#8-feature-pages-renderer)
9. [Background workers](#9-background-workers)
10. [LLM layer](#10-llm-layer)
11. [ExecEngine connection layer](#11-execengine-connection-layer)
12. [Tooltip / help system](#12-tooltip--help-system)
13. [System tray + window lifecycle](#13-system-tray--window-lifecycle)
14. [Build, package, install](#14-build-package-install)
15. [Configuration & persistence](#15-configuration--persistence)
16. [Security posture](#16-security-posture)
17. [What's real vs mocked](#17-whats-real-vs-mocked)
18. [Operational notes](#18-operational-notes)

---

## 1. What it is

**ShortCut Studio** is a Windows-first Electron desktop app that gives researchers and academics one place to manage their personal eBook / paper library. It is the **client-side UI** of the SCL document-processing ecosystem — a Consumer Peer in a larger network where:

- The user picks folders to scan (PDF, EPUB, MOBI)
- Background Python workers (SCL_Demo) extract text and metadata
- LLMs (Ollama / OpenAI / Claude / Gemini) generate topics, classify documents, summarise content
- Eventually, peer-to-peer machinery (ExecEngine) shares processed metadata across researchers — so each user benefits from work others have already done

The app's job is the UI + orchestration: it doesn't do the scanning or the AI work itself; it owns the folder-picking UX, the LLM key management, the dashboard that shows progress, the topic-review workflow, and the per-mode (Public / Private) library separation.

**npm package name**: `shortcut-studio`. **Windows installer**: `ShortCut Studio-Setup-<version>.exe`. **Electron `productName`**: `ShortCut Studio`. **Current version**: 0.3.0.

**Adjacent projects** (separate repositories on the same machine):

| Repo | Path | Role |
|---|---|---|
| **SCL_Demo** | `D:/Client-Side_Project/SCL_Demo/` | Python workers that scan filesystems, extract text, run Gemini for topic classification. ShortCut Studio spawns and supervises these as `.exe` processes. |
| **ExecEngine** | `D:/ExecEngine/` | The distributed P2P scheduler. Has TCP Queue infrastructure (ports 44998/44999) and an HTTP SIS (Sign-In Service) on 44450. ShortCut Studio authenticates against SIS as a Consumer Peer; the rest of the protocol is documented but not yet implemented in this client. |

---

## 2. Tech stack

| Layer | Choice | Version | Why |
|---|---|---|---|
| Desktop runtime | **Electron** | 33.2.1 | Mature; bundled Chromium + Node; Windows-friendly |
| Build tool | **electron-vite** | 2.x | Three Vite builds (main / preload / renderer) with shared watch mode |
| Languages | **TypeScript** strict, **React 18**, **JSX** | TS 5, React 18.3 | Industry standard; strict mode catches IPC type drift |
| UI library | **shadcn/ui** primitives (Radix under the hood) | latest | Owned components, no runtime overhead |
| Styling | **Tailwind v3** + CSS variables | 3.x | Utility-first; theme tokens swap on `.dark` class |
| Data fetching | **@tanstack/react-query** | 5.x | Caching, polling, optimistic updates |
| Local state | **Zustand** | 5.x | One store for Dev mode + dock-style persisted UI bits |
| Database | **better-sqlite3** | 11.x | Synchronous, fast, ideal for main-process workloads |
| Routing | **react-router-dom** HashRouter | 6.x | HashRouter so Electron's `file://` works without server |
| Icons | **lucide-react** | latest | Consistent stroke icons; tree-shakeable |
| Installer | **electron-builder** | 25.x | NSIS for Windows; auto-update plumbing |
| Native deps rebuild | `electron-builder install-app-deps` (postinstall) | — | Rebuilds `better-sqlite3` against the bundled Electron's Node ABI |

Key engineering choices:

- **Path aliases** (configured in both `electron.vite.config.ts` runtime and `tsconfig.*.json` typecheck):
  - `@/*` → `src/renderer/*`
  - `@shared/*` → `src/shared/*`
  - `@main/*` → `src/main/*`
- **Strict TS everywhere.** No `any` without comment.
- **No jQuery, no Bootstrap, no class components.** The Bootstrap+jQuery predecessor (ElectronAdmin2) was deleted in the 2026-04-23 cleanup.
- **Dark mode default.** `<html class="dark">` ships set; toggle adds/removes `.dark`.

---

## 3. Process architecture

Electron splits the app into three processes. ShortCut Studio uses all three with a strict separation:

```
┌─────────────────────────────────────────────────────────────────────┐
│                           MAIN PROCESS                              │
│  src/main/                                  (Node.js + Electron)    │
│                                                                     │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ SQLite     │  │  IPC        │  │ Workers      │  │ ExecEngine │  │
│  │ better-    │  │  Handlers   │  │ Supervisor   │  │ Auth +     │  │
│  │ sqlite3    │  │  (~25 files)│  │ (spawn .exes)│  │ HTTP SIS   │  │
│  └────────────┘  └─────────────┘  └──────────────┘  └────────────┘  │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────┐                  │
│  │ Window     │  │ Tray + Menu │  │ LLM dispatch │                  │
│  │ lifecycle  │  │             │  │ (4 providers)│                  │
│  └────────────┘  └─────────────┘  └──────────────┘                  │
└────────────────────────────┬────────────────────────────────────────┘
                             │ ipcMain.handle / .send
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          PRELOAD                                    │
│  src/preload/index.ts            (context-isolated bridge)          │
│                                                                     │
│   contextBridge.exposeInMainWorld('electronAPI', { ... })           │
│   - Single typed surface, no raw ipcRenderer leak                   │
│   - Wraps every IPC channel as api.<domain>.<method>(...)           │
└────────────────────────────┬────────────────────────────────────────┘
                             │ window.electronAPI
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        RENDERER PROCESS                             │
│  src/renderer/                   (Chromium; pure browser)           │
│                                                                     │
│  React 18 SPA:                                                      │
│    AppShell (Sidebar + Header + Page slot + InfoSection)            │
│    Pages:  Dashboard | Folders | Topics | Insights | KnowledgeMap   │
│            Filters    | LLMs   | Community | Privacy | Settings     │
│    Dev overlay (Ctrl+Shift+D — 7 tabs)                              │
│                                                                     │
│  Data: React Query against window.electronAPI                       │
│  No direct file/network/DB access (CSP + contextIsolation enforce)  │
└─────────────────────────────────────────────────────────────────────┘
```

**Strict rules:**

1. **Renderer never touches the OS.** No `require('electron')`. No `node:fs`. Everything goes through `api.<domain>.<method>()` (which is `window.electronAPI.<domain>.<method>()` re-exported from `@/lib/api`).
2. **Channel names are constants** in `src/shared/ipc-channels.ts`. Never string literals.
3. **All IPC is `invoke`/`handle` (promise-based)**, not `send`/`on`. Two exceptions, both push-only main→renderer events: `dev:toggle` and `filters:classify-progress` and `dev:storybook-log`.
4. **Types are shared.** `src/shared/types.ts` is imported by both main and renderer; the IPC surface type lives in `src/shared/api.ts` and is what the preload's `contextBridge` exposes.
5. **better-sqlite3 is synchronous**, but every IPC handler is `async`. The synchronous DB call inside an async handler is fine for our query sizes (< 10 ms typical).

---

## 4. Repository layout

```
D:/Client-Side_Project/ShortCut_Studio/
├── .vscode/                          shared workspace config (force-added)
├── .claude/                          project-scoped Claude Code skills + commands
├── _Docu/                            owner-supplied design PDFs
├── docs/
│   ├── ARCHITECTURE.md               ← this file
│   └── claude-handoff/               session-handoff narrative for Claude/human collaborators
│       ├── README.md
│       ├── 01-conversation-log.md
│       ├── 02-approved-plan.md
│       ├── 03-key-decisions.md
│       ├── 04-architecture.md        (older companion to this doc)
│       ├── 05-features-built.md
│       ├── 06-pending-and-caveats.md
│       └── 07-how-to-continue.md
├── CLAUDE.md                         repo-root agent instructions
├── README.md
└── src/src/                          ← ACTIVE codebase (the nesting is intentional)
    ├── package.json                  npm scripts + deps
    ├── electron.vite.config.ts       three Vite configs (main/preload/renderer) + path aliases
    ├── tsconfig.json                 root references node + web
    ├── tsconfig.node.json            main + preload TS project
    ├── tsconfig.web.json             renderer TS project
    ├── tailwind.config.js
    ├── components.json               shadcn/ui config
    ├── electron-builder.yml          NSIS installer config
    ├── resources/
    │   ├── icon.ico                  256×256 multi-res app icon
    │   └── README.md
    ├── exe/                          LocalHostTools (SCL_ListPorts.exe, etc.) bundled into installer
    ├── db_files/loc_adm.db           main SQLite DB (gitignored)
    ├── out/                          electron-vite build output (gitignored)
    ├── release-builds/               NSIS installer + win-unpacked/ (gitignored)
    ├── scripts/
    │   ├── run-clean.mjs             strips ELECTRON_RUN_AS_NODE before npm-script execs
    │   └── storybook.ts              Playwright-driven page screenshotter
    ├── storybook/                    generated screenshots + descriptions
    └── src/
        ├── main/                     Electron main process (TypeScript)
        │   ├── index.ts              entry: app.whenReady → init DB + auth + IPC + workers + window + tray
        │   ├── window.ts             BrowserWindow factory; hide-on-close
        │   ├── tray.ts               system tray + context menu (resize-to-16x16 fix)
        │   ├── icon.ts               shared resolveAppIconPath() for tray + window
        │   ├── db/
        │   │   ├── connection.ts     better-sqlite3 wrapper (dev: local, packaged: userData)
        │   │   ├── migrations.ts     idempotent CREATE TABLE + ALTER + seeds
        │   │   └── scl-folder.ts     read-only access to SCL_Demo's mode-specific DB
        │   ├── ipc/                  one file per domain (15 files)
        │   │   ├── index.ts          register all handlers at boot
        │   │   ├── app.ts | mode.ts | dataSource.ts | folders.ts | fileTypes.ts
        │   │   ├── llm.ts | settings.ts | progress.ts | topics.ts | superCategories.ts
        │   │   ├── ipfs.ts | privacy.ts | diagnostics.ts | system.ts | drives.ts
        │   │   ├── insights.ts | filters.ts | knowledgeMap.ts | network.ts
        │   │   ├── dev.ts | system-check.ts
        │   │   └── execengine.ts     ← Round 2 (2026-04-28)
        │   ├── workers/
        │   │   ├── config.ts         SUPERVISED_WORKERS + resolveWorkersDir
        │   │   └── supervisor.ts     spawn / log capture / exponential backoff / health poll
        │   ├── filters/              classifier subsystem (legacy LLM consumer)
        │   │   ├── ruleEngine.ts     in-memory rule evaluator
        │   │   ├── prompts.ts        buildClassifierPrompt + parseClassifierResponse
        │   │   ├── classifier.ts     job orchestrator (sequential batches)
        │   │   └── providers/        per-provider classifier adapters
        │   │       ├── httpJson.ts   shared electron.net wrapper with URL redaction
        │   │       ├── ollama.ts | openai.ts | claude.ts | gemini.ts
        │   │       ├── mock.ts | clipboard.ts
        │   │       └── index.ts      ClassifierAdapter interface
        │   ├── llm/                  ← Round 1 (2026-04-28)
        │   │   ├── providerName.ts   shared PROVIDER_NAME_BY_CODE map (used by classifier + completion)
        │   │   ├── modelDiscovery.ts auth-validating model-list fetch
        │   │   └── completion/
        │   │       ├── types.ts      CompletionAdapter / Opts / Result interfaces
        │   │       ├── index.ts      complete() dispatcher + hoistSystemMessage + logUsage
        │   │       ├── ollama.ts     /api/chat with ECONNREFUSED rewrap
        │   │       ├── openai.ts     /v1/chat/completions with o-series detection
        │   │       ├── claude.ts     /v1/messages with system-hoist
        │   │       └── gemini.ts     /v1beta/models/{m}:generateContent
        │   ├── execengine/           ExecEngine client (Round 2 expanded)
        │   │   ├── client.ts         IExecEngineClient interface + getExecEngine() factory
        │   │   ├── mock.ts           MockExecEngineClient (synthetic data)
        │   │   ├── realLocal.ts      RealLocalExecEngineClient (real SCLFolder reads + mock peer)
        │   │   ├── real.ts           ← Round 2 — RealExecEngineClient skeleton
        │   │   ├── sisAuth.ts        ← Round 2 — HTTP client for SIS endpoints
        │   │   ├── authState.ts      ← Round 2 — session token + state lifecycle
        │   │   └── protocol.ts       ← Round 2 — typed CBR/CDREQ/CSCT/RBC/etc. message contracts
        │   ├── mock/                 (deleted — Round 1 retired insights mock)
        │   ├── os/                   drives / fs-preview / local-tools (Windows shell)
        │   └── system-check/         system-check.ts: aggregates worker + Ollama + DB statuses
        ├── preload/
        │   └── index.ts              contextBridge.exposeInMainWorld('electronAPI', api)
        ├── renderer/
        │   ├── index.html            Vite entry; tight CSP meta tag
        │   ├── main.tsx              ReactDOM root + QueryClient + HashRouter
        │   ├── App.tsx               <AppShell><Routes>...</Routes></AppShell>
        │   ├── components/
        │   │   ├── ui/               shadcn primitives (button, card, dialog, input, badge, tooltip, sheet, skeleton, toast, help-hint, ...)
        │   │   ├── layout/           AppShell, Sidebar, Header (with mode toggle), InfoSection, AboutDialog
        │   │   ├── visual/           Hero, ColorfulStat, PeerNetwork, AllocationDisc, Burst, WorkerConstellation, ProviderHub, PrivacyShield, etc.
        │   │   ├── drive-tree/       DriveTree (folder picker)
        │   │   └── dev/              DevOverlay + 7 tab components (DevTools / Workers / SQL / IPC / Storybook / System / LlmPlayground)
        │   ├── features/             one folder per sidebar section
        │   │   ├── dashboard/        DashboardPage + ProgressGlass + TimeRangeBar + DedupCard + HoursSavedCard + NetworkCard
        │   │   ├── folders/          FoldersPage + DriveTree integration
        │   │   ├── topics/           TopicsPage + TopicDistributionChart
        │   │   ├── insights/         InsightsPage (real SCLFolder reads)
        │   │   ├── knowledge-map/    KnowledgeMapPage + Constellation SVG renderer
        │   │   ├── filters/          FilterWorkbenchPage + RuleBuilder + PreviewPanel + ClassifyDialog + PresetsMenu
        │   │   ├── llm/              LlmPage + OnboardingDialog + provider-onboarding.ts
        │   │   ├── community/        CommunityPage (IPFS UI; backend stubbed)
        │   │   ├── privacy/          PrivacyPage
        │   │   ├── settings/         SettingsPage + ExecEngineCard ← Round 2
        │   │   ├── about/            AboutPage
        │   │   ├── getting-started/  GettingStartedPage
        │   │   ├── setup/            SetupWizard (first-run)
        │   │   └── welcome/          WelcomePage
        │   ├── lib/
        │   │   ├── utils.ts          cn() + formatNumber()
        │   │   ├── api.ts            export const api = window.electronAPI
        │   │   ├── app-info.ts       version + build date constants
        │   │   └── mutation-toast.ts toast helper for mutation results
        │   ├── hooks/                use-count-up, use-debounced-value, use-row-selection, use-toast
        │   ├── stores/               devMode.ts (Zustand store)
        │   └── styles/
        │       └── globals.css       @tailwind directives + shadcn CSS variables
        └── shared/                   used by BOTH main and renderer
            ├── ipc-channels.ts       channel-name constants (single source of truth)
            ├── types.ts              ~50 domain types (FolderRow, Job, ProgressSummary, LlmCompleteRequest, ExecEngineConnectionStatus, ...)
            └── api.ts                ElectronAPI interface (declares Window['electronAPI'])
```

---

## 5. Boot sequence

`npm run dev` → `node scripts/run-clean.mjs electron-vite dev`. The `run-clean.mjs` script strips any inherited `ELECTRON_RUN_AS_NODE` env var (a common dev-machine contaminant from Chromium tooling), then spawns `electron-vite dev`, which builds main + preload (watch mode) and serves the renderer via Vite dev server.

The Electron main process starts at `out/main/index.js` (built from `src/main/index.ts`). Its bootstrap is **strictly ordered** so each step's prerequisites are met:

```
src/main/index.ts::bootstrap()
  1. await app.whenReady()
  2. initDatabase()                 // opens loc_adm.db with WAL + foreign_keys=ON
  3. runMigrations()                // idempotent CREATE TABLE + ALTER ADD COLUMN; safe on every boot
  4. initErrorsDb()                 // opens errors.db (separate file, WAL + synchronous=NORMAL); inline schema migration
  5. initAuthState()                // Round 2: load persisted SIS token from AdminData
  6. registerIpcHandlers()          // installs IPC error trap, then registers ~22 domain handler modules
  7. startWorkerSupervisor()        // spawns root_watchdog.exe / topic_watchdog.exe / gemini_processor.exe
  8. void verifyPersistedToken()    // Round 2: fire-and-forget SIS verify
  9. mainWindow = createMainWindow()
 10. attachDevModeShortcut(mainWindow)   // Ctrl+Shift+D
 11. createTray(mainWindow)
```

Shutdown via `before-quit`:

```
markQuitting()       // window.ts close handler stops hiding to tray
destroyTray()
stopAllWorkers()     // taskkill each spawned exe + cancel restart timers
closeDatabase()      // independent try/catch — a throw here doesn't leak the next handle
closeErrorsDb()      // independent try/catch
```

In packaged builds, `app.isPackaged` is true and:
- `loc_adm.db` lives at `app.getPath('userData')/db_files/loc_adm.db` (copied from bundled seed on first launch)
- `errors.db` lives at `app.getPath('userData')/db_files/errors.db` (created fresh on first launch — no seed needed)
- `SCLFolder_*.db` lives at `app.getPath('userData')/scl_db_files/` (copied from `process.resourcesPath/scl_db_seed/`)
- Workers resolve from `process.resourcesPath/workers/`

---

## 6. Data layer

### Four SQLite databases

| File | Owner | Access from this app | Purpose |
|---|---|---|---|
| `loc_adm.db` | ShortCut Studio | **read + write** (main only) | All admin config — providers, folders, models, settings, ExecEngine session, privacy terms, super-categories, file-type filters, OCR jobs, AI labels, LLM usage |
| `errors.db` | ShortCut Studio | **read + write** (main only) | App-wide errors store — single `AppErrors` table, capped at 10k rows. Separated from `loc_adm.db` for privacy (sharable debug bundle), corruption isolation, and faster writes (`synchronous=NORMAL`) |
| `SCLFolder_Publ.db` | SCL_Demo's scanner | **read-only** | Public-mode scan data: Files, Folders, FileDuplicates, TopicNames, TopicFiles |
| `SCLFolder_Priv.db` | SCL_Demo's scanner | **read-only** | Private-mode scan data (same schema) |

`scl-folder.ts::openSclFolderDb()` returns a read-only handle to whichever mode is active. If the file doesn't exist (fresh install pre-scan), returns `null` and helper functions fall back to safe empty values.

### `loc_adm.db` schema (migrations.ts seeds + ALTERs)

```sql
-- Singleton row holding global settings
AdminData(
  RecID PK = 1,
  Localhost_Port = 44999,
  NumTopicThreshold = 10,
  CPU_Perf_Threshold = 50,
  SetupCompleted INT,                        -- additive ALTER
  WelcomeOnStartup INT,                      -- additive ALTER
  ExecEngineSisHost  TEXT = 'localhost',     -- Round 2 ALTER
  ExecEngineSisPort  INT  = 44450,           -- Round 2 ALTER
  ExecEngineSessionToken TEXT,               -- Round 2 ALTER (24h SIS token; replaced on signin)
  ExecEngineCpId TEXT,                       -- Round 2 ALTER
  ExecEngineMasterId TEXT,                   -- Round 2 ALTER
  ExecEngineTokenExpiresAt INT               -- Round 2 ALTER
)

-- User-configured scan roots
Folder(ID PK, Path TEXT, Include 'Y'|'N', ProcRound, LastUpd_CT)

-- LLM provider config (6 seeded as of v0.4.0: Ollama, OpenAI, Claude, Gemini,
-- HuggingFace, LM Studio). The single source of truth for "is this provider
-- local?" is @shared/providers.ts::LOCAL_PROVIDER_NAMES — used by both the
-- dispatcher's no-key-required exemption and the renderer's "Local" badge.
-- A v0.3.x → v0.4.x migration canonicalises any 'Claude, Anthropic' rows
-- back to 'Claude' so the dispatcher's name-to-code map resolves cleanly.
LLM_Provider(Provider_ID PK, Provider_Name, Has_API_Key, API_Key TEXT,
             API_Host, IsDefault, Supported, AllowAddModel)

-- Per-provider model list (auto-populated by llm:discover-models)
Models(ModelID PK, ProviderID FK, ModelName, ProviderDefault)

-- Background job ledger (currently used by topics:generate; consumer not yet wired)
OCR_Process(JobID PK, Kind, Status, Label, StartedAt, FinishedAt,
            ProgressCurrent, ProgressTotal, Error)

-- Top-level topic groupings + their topic-to-supercategory mapping
SuperCategories(SuperCategoryID PK, Name UNIQUE)
TopicSuperCategoryMap(topicName PK, superCategoryId FK ON DELETE CASCADE)

-- Privacy-routing terms (system seeds + user adds)
PrivacyTerms(id PK, term UNIQUE, source 'system'|'user')

-- LLM token usage log — Round 1 made this real
LLM_Usage(id PK, providerId, tokensIn, tokensOut, ts,
          modelId,    -- Round 1 ALTER
          feature,    -- Round 1 ALTER (e.g. 'classifier', 'playground')
          latencyMs)  -- Round 1 ALTER

-- AI classification labels per file (filter workbench)
FileAiLabels(fileId PK, label, confidence, model, classifiedAt, reason)

-- Saved filter rule presets
FilterPresets(id PK, name UNIQUE, ruleJson, createdAt, lastUsed)

-- File-type allowlist (PDF/EPUB enabled by default; MOBI shown but disabled)
FileTypeFilters(extension PK, label, enabled INT, sortOrder)

-- v1.5 history line chart — schema exists, nothing writes to it yet
ProgressSnapshots(ts PK, cumulativeLocal, cumulativePeer)
```

### `errors.db` schema (errorsConnection.ts inline migration)

```sql
-- Single-table app-wide errors store. Captured from four sources via:
--   - main/ipc/installErrorTrap.ts  (every IPC handler throw)
--   - main/llm/completion/index.ts  (provider call failures)
--   - main/execengine/authState.ts  (SIS signin/verify/health failures)
--   - main/workers/supervisor.ts    (worker crashes + restart-cap give-up)
--   - renderer/main.tsx + components/error-boundary.tsx (uncaught + unhandled rejection + render errors)
-- Rolling 10k row cap, probabilistic trim (1% per insert).
-- Live UI: Settings → Diagnostics → Errors panel.
AppErrors(
  id PK AUTOINCREMENT,
  ts INTEGER NOT NULL,        -- ms since epoch
  source TEXT NOT NULL,       -- 'ipc' | 'llm' | 'execengine' | 'worker' | 'renderer' | 'main'
  severity TEXT NOT NULL,     -- 'error' | 'warning' (VALIDATION:-prefixed throws are 'warning')
  category TEXT,              -- ipc-channel-name / worker-name / sis-* / route hash
  message TEXT NOT NULL,      -- redacted, capped at 4 KB
  stack TEXT,                 -- redacted, capped at 4 KB
  context TEXT                -- redacted JSON blob, capped at 8 KB
)

CREATE INDEX idx_AppErrors_ts ON AppErrors(ts DESC)
CREATE INDEX idx_AppErrors_source ON AppErrors(source, ts DESC)
```

**Why separate from `loc_adm.db`** — privacy (a future "send debug bundle to support" flow can ship `errors.db` without leaking API keys / user folder paths from `LLM_Provider` / `Folder`); corruption isolation (a wedged `loc_adm.db` doesn't take the error log down with it — the log is what you need most when something's wrong); tunable durability (`synchronous=NORMAL` is fine for debug data, while `loc_adm.db` stays at `FULL` for config integrity); drop-without-fear ("reset error history" = delete the file).

**Redaction** (`errorStore.ts::redactValue`) — strips OpenAI `sk-...`, Claude `sk-ant-api...`, Gemini `AIza...` patterns plus header keys (`Authorization`, `X-Api-Key`, `password`, `token`, etc.). Bounded recursion (depth=4, array slice=20, total-node budget=1000) defends against pathological nested inputs.

**`recordError` is contractually non-throwing** — wrapped in outer try/catch with `console.error` fallback. The diagnostics layer must never crash the thing it's observing.

### Mode toggle (Public ↔ Private)

A single in-memory variable `currentMode: 'publ' | 'priv'` lives in `src/main/ipc/mode.ts`. Defaults to `'publ'` on every app boot (not persisted — by design; users prefer "Public is the safe default after a restart"). Changed via `api.mode.set(next)`.

When mode flips, `Header.tsx` calls `qc.invalidateQueries()` with no key argument — nuclear refresh of every React Query cache. Costs unnecessary refetches for queries that don't depend on mode (LLM providers, settings, etc.) but is simpler than tracking mode-dependence per query.

### Path resolution at runtime

```
locAdmDbPath() in connection.ts:
  if dev:        <repo>/src/src/db_files/loc_adm.db
  if packaged:   app.getPath('userData')/db_files/loc_adm.db
                  ↑ first launch: copies from process.resourcesPath/db_files/loc_adm.db

sclDbDir() in scl-folder.ts:                              -- v0.4.0 layout
  env override:  process.env.SCL_DEMO_DB_DIR
  if dev:        D:/Client-Side_Project/SCL_Demo/db_files
  if packaged:   app.getPath('userData')/scl_data/db_files/
                  ↑ first launch: copies from process.resourcesPath/scl_data_seed/db_files/
                  ↑ v0.3.x users: one-time migration from <userData>/scl_db_files/
                  ↑ supervisor sets SCL_DEMO_DATA_ROOT=<userData>/scl_data
                    in spawned-worker env so the Python resolver short-circuits

sclDataRootDir() in scl-folder.ts:                        -- v0.4.0 helper
  always:        app.getPath('userData')/scl_data
                  ↑ contains db_files/ subdir; passed to workers as
                    SCL_DEMO_DATA_ROOT env var by the supervisor
```

---

## 7. IPC surface

Every IPC channel has four touchpoints, ALL kept in sync:

1. **Constant** in `src/shared/ipc-channels.ts` (`IpcChannel.Foo`)
2. **Handler** in `src/main/ipc/<domain>.ts` (`ipcMain.handle(IpcChannel.Foo, ...)`)
3. **Preload bridge** in `src/preload/index.ts` (`api.<domain>.<method>: (...args) => ipcRenderer.invoke(IpcChannel.Foo, ...args)`)
4. **API type** in `src/shared/api.ts` (`<domain>: { <method>: (...args) => Promise<...> }`)

The `audit-ipc` Claude Code skill cross-checks all four for any drift.

### Full channel catalog (current state)

| Domain | Channel | Method (renderer) | Notes |
|---|---|---|---|
| **app** | `app:quit` | `api.app.quit()` | |
| | `app:open-external` | `api.app.openExternal(url)` | `shell.openExternal` |
| | `app:get-version` | `api.app.getVersion()` | |
| **mode** | `mode:get` | `api.mode.get()` | Returns 'publ'\|'priv' |
| | `mode:set` | `api.mode.set(next)` | |
| **dataSource** | `dataSource:get` / `:set` | `api.dataSource.get/set` | Demo vs. Prod toggle (Header pill) |
| **folders** | `folders:list` | `api.folders.list()` | Includes real folder-health metrics from SCLFolder |
| | `folders:add` | `api.folders.add(paths, forceInclude?)` | Parent/child include/exclude logic |
| | `folders:remove` | `api.folders.remove(id)` | |
| | `folders:update-path` | `api.folders.updatePath(id, newPath)` | Validates path exists |
| | `folders:pick-directory` | `api.folders.pickDirectory()` | Native OpenDialog |
| | `folders:health` | _(orphaned — no preload bridge)_ | Handler exists; not currently used by renderer |
| **file-types** | `file-types:list` / `:toggle` / `:add` / `:remove` | `api.fileTypes.*` | Global on/off list |
| **llm** | `llm:list-providers` | `api.llm.listProviders()` | Reads LLM_Provider |
| | `llm:update-key` | `api.llm.updateKey(providerId, key)` | Plaintext store (by design) |
| | `llm:list-models` | `api.llm.listModels(providerId)` | Reads Models |
| | `llm:add-model` | `api.llm.addModel(providerId, name)` | |
| | `llm:set-default-model` | `api.llm.setDefaultModel(modelId)` | Atomically clears prior default |
| | `llm:test-connection` | `api.llm.testConnection(providerId)` | Auth-validating (calls discovery) |
| | `llm:discover-models` | `api.llm.discoverModels(providerId)` | Hits provider's /models endpoint |
| | `llm:complete` | `api.llm.complete(req)` | **Round 1**: generic chat completion |
| **settings** | `settings:get` / `:update` | `api.settings.get/update` | AdminData wrapper |
| **progress** | `progress:summary` | `api.progress.summary(range)` | Real local + mock peer |
| | `progress:jobs` | `api.progress.jobs()` | Synthetic 3-job list |
| | `progress:history` | `api.progress.history(range)` | Synthetic curve |
| | `progress:by-stage` | `api.progress.byStage(range)` | **Per-tab real counts** (Scan/LLM/References/KM) |
| | `progress:dedup-summary` | `api.insights.dedupSummary()` | Real |
| **topics** | `topics:list` / `:generate` / `:auto-organize` / `:review` / `:approve` / `:distribution` / `:reject` / `:rename` / `:merge` | `api.topics.*` | Mix of real (loc_adm) + mock (review queue) |
| **super-categories** | `super-categories:list` / `:create` / `:rename` / `:remove` / `:assign` / `:unassign` | `api.superCategories.*` | All real |
| **ipfs** | `ipfs:status` / `:set-allocation` | `api.ipfs.status/setAllocation` | Stubbed via mock |
| **privacy** | `privacy:list-terms` / `:update-terms` | `api.privacy.*` | Real |
| **diagnostics** | `diagnostics:workers` / `:restart-worker` / `:tail-log` | `api.diagnostics.*` | Real (supervisor state) |
| | `diagnostics:list-errors` / `:clear-errors` / `:record-renderer-error` | `api.diagnostics.listErrors / clearErrors / recordRendererError` | **Errors DB**: list/filter, clear-all, renderer→main forwarder for uncaught exceptions |
| **system** | `system:open-file` / `:reveal-folder` / `:list-drives` / `:list-children` | `api.system.*` | OS shell integration |
| **insights** | `insights:list` / `:groups` | `api.insights.list/groups` | **Real** SCLFolder reads |
| **filters** | `filters:preview` / `:list-presets` / `:save-preset` / `:delete-preset` / `:classify` / `:classify-progress` (push) / `:clipboard-prompt` / `:clipboard-apply` | `api.filters.*` | Rule engine + LLM classifier |
| **knowledge-map** | `knowledge-map:graph` | `api.knowledgeMap.graph(params)` | Real SCLFolder + super-categories |
| **dev** | `dev:open-devtools` / `:close-devtools` / `:reload` / `:hard-reset` / `:get-paths` / `:sql-select` / `:get-storybook-info` / `:capture-storybook` / `:open-storybook-folder` / `:storybook-log` (push) / `:list-storybook-screenshots` / `:system-check` / `:toggle` (push) | `api.dev.*` | Hidden behind Ctrl+Shift+D |
| **network** | `network:summary` | `api.network.summary()` | Mock peer + real DB-file sizes |
| **execengine** | `execengine:get-status` | `api.execengine.getStatus()` | **Round 2** |
| | `execengine:set-config` | `api.execengine.setConfig(config)` | Host/port edit |
| | `execengine:sign-in` | `api.execengine.signIn(req)` | Real SIS HTTP |
| | `execengine:sign-out` | `api.execengine.signOut()` | |
| | `execengine:health-check` | `api.execengine.healthCheck()` | Probes SIS /health |

---

## 8. Feature pages (renderer)

Every page lives at `src/renderer/features/<page>/<Page>.tsx` and is wired into `App.tsx` routes. The `Sidebar.tsx` declares which routes appear in the nav.

### Dashboard (`/dashboard`)

The flagship page. Two **Progress Glass** SVG bottles (cumulative "All time" + windowed "Last X") show the active processing-stage's percentage. A 4-tab strip (`Scan / LLM / References / KM`) selects the stage:

- **Scan**: `Files.Words500 != '' OR Probability > 0` — text was extracted
- **LLM**: `Files.Probability > 0` — Gemini ran
- **References**: estimated as `LLM × 0.55 / 0.72` with an "Est" badge (no schema column yet)
- **KM**: `EXISTS in TopicFiles` — file is joined to a topic

Below: 4 ColorfulStat cards (Total / Processed locally / From peers / Remaining), Δ deltas, ETA, Active jobs panel, DedupCard, HoursSavedCard, NetworkCard.

Refetches every 3s via React Query. Falls back to mock entirely if no SCLFolder DB exists.

### Folders (`/folders`)

Two cards: **File types** (chip toggles for PDF/EPUB/etc.) and **Indexed folders** (table with include/exclude badges). Each row shows real per-folder file count + dupe count + privacy-match count from SCLFolder. A "Browse drives" button opens a DriveTree dialog for native folder picking.

### Topics (`/topics`)

Three pipeline pills (Pending review / Approved topics / Super-categories). "Auto-organize" + "Generate topics" buttons (the latter creates an `OCR_Process` row that doesn't yet have a consumer — Round 3 territory). Below: TopicBrowser, TopicDistributionChart (Recharts pie/bar), SuperCategoryAtoms visual, ReviewQueue.

### Insights (`/insights`)

Per-file extraction quality table sourced from real SCLFolder reads: file name, page count, extraction-confidence (`Probability`), warnings. Sortable, paged. The aggregations (avg extraction %, low-confidence count) are computed in JS after a full table read — fine for v1, would need DB-side aggregation at scale.

### Knowledge Map (`/knowledge-map`)

A radial constellation SVG: YOU → Super-categories → Topics → sample Files. Click a node to see its details. Search dims non-matching nodes; super-category filter narrows the graph. Sample files per topic is configurable (default 4).

### Filter Workbench (`/filters`)

Live rule builder. AND-combined filter rules: `minPages / maxPages / filenameIncludes / filenameExcludes / aiLabel / extractionMin / maxWarnings`. Live PreviewPanel shows matched/excluded counts. **Classify with AI** dialog routes file-name batches through the configured LLM provider's classifier adapter and persists labels to `FileAiLabels`. Saved rule sets become reusable presets.

### LLMs (`/llm`)

Provider cards for **Ollama / OpenAI / Claude / Gemini / HuggingFace / LM Studio** (last two added v0.4.0). Cloud providers show an API key input (with show/hide), Test button (auth-validating via discovery), Refresh-models button (calls `/models` and repopulates the `Models` table), and brand-coloured status badges. Local providers (Ollama, LM Studio — single source of truth in `@shared/providers.ts`) suppress the key input and show a "make sure the local server is running on \<host\>" hint instead. An OnboardingDialog walks the user through obtaining keys / installing local servers for each provider.

Each cloud-provider card additionally shows an **"Open usage dashboard"** button below its status — opens the provider's billing/usage page in the browser via `app.openExternal`. URLs verified live (see `renderer/features/llm/dashboard-urls.ts`). The OpenAI card additionally shows today's USD spend inline by hitting `/v1/usage` (undocumented but functional; defensive parsing tries `total_usage` then sums `data[].cost`; hides on any failure so the dashboard link always remains as fallback).

PrivacyShield callout at top warning about sharing expertise with commercial LLMs.

### Community (`/community`)

UI for IPFS allocation and peer count. Backend stubbed (`MockExecEngineClient` returns `running: false, peerCount: 0`). PeerNetwork SVG visualisation, AllocationDisc disc-meter, allocation slider with min computed from local library size. Banner at top says "Community features are not wired to the backend yet".

### Privacy (`/privacy`)

Two cards. **System defaults**: locked baseline terms (personal, private, confidential, draft, etc.). **Your terms**: user-added substring patterns. Files whose path matches any term get routed to the Private database. PrivacyShield + Library mode card (toggle Public/Private) on the same page.

### Settings (`/settings`)

Multiple cards in order:

- **Paths** — shows hidden content folder + Desktop search folder (Move buttons disabled; not yet implemented)
- **Admin values** — Localhost port (default 44999), Topic threshold, CPU threshold
- **ExecEngine connection** ← **Round 2**. Connection state badge, host/port editor, sign-in dialog, sign-out, health-check button. Polls `getStatus` every 10s.
- **Errors** — App-wide errors panel reading `errors.db`. Severity + source filters, expandable rows showing stack + context, "Clear all" button with confirm dialog, 5s auto-refresh, paginated 50/page. Default filter is `severity=error` to hide validation noise.
- **Diagnostics** (gated by `SHOW_DIAGNOSTICS=true` env at build) — WorkerConstellation visualisation + per-worker rows with status, last health check, Restart button, log-tail viewer.

### Setup, Welcome, Getting Started, About

First-run / docs surface; not deeply functional but provides onboarding context.

### Dev mode (`Ctrl+Shift+D` overlay)

Hidden side panel with 7 tabs. Bypasses normal user UX:

| Tab | Content |
|---|---|
| **Tools** | Open DevTools, Reload, Hard reset (clears caches), open paths |
| **Workers** | Live WorkerConstellation + restart buttons (when `SHOW_DIAGNOSTICS` not set) |
| **SQL** | Read-only SELECT runner against `loc_adm.db` |
| **IPC** | Live IPC event log (channel + args + duration + result size) |
| **Storybook** | Trigger Playwright screenshot run; open output folder |
| **System** | Aggregated worker / Ollama / DB / version checks |
| **LLM** | ← Round 1 **LLM Playground** — pick provider/model, send a prompt, see content + token counts + latency, recent results in panel |

---

## 9. Background workers

ShortCut Studio supervises three long-running workers from SCL_Demo. The supervisor in `src/main/workers/supervisor.ts` does:

1. **Spawn** each `.exe` with three env vars injected:
   - `WORKER_HEALTH_PORT` — port for the worker's FastAPI `/health` + `/status` server (19001/19002/19003).
   - `ELECTRON_LLM_BRIDGE_PORT` — `45123`. Tells workers where to POST chat-completion requests so the user's GUI provider choice drives scan-time topic naming. Workers no longer hold provider API keys themselves. (See §10 → "LLM bridge for workers".)
   - `SCL_DEMO_DATA_ROOT` — packaged builds only. Set to `<userData>/scl_data`. The Python workers' resolver short-circuits to this path instead of walking up from `sys.executable` looking for an ancestor `db_files/`.
2. **Capture stdout + stderr** into a per-worker ring buffer (last 400 lines) for log-tail viewer
3. **Track exit events**. On non-zero exit code, schedule a restart with exponential backoff (`2_000 * 2^n` ms, capped at 30s, max 5 attempts).
4. **Health-poll** every 10s: `GET http://127.0.0.1:<port>/health`. Failure is non-fatal — worker may not have adopted the FastAPI wrapper yet.

| Worker | Default port | Auto-start | Args | Source file (in SCL_Demo) |
|---|---|---|---|---|
| `root_watchdog` | 19001 | yes | — | `scan/multi_watchdog_manager.py` |
| `topic_watchdog` | 19002 | yes | — | `scan/topic_watchdog.py` |
| `gemini_processor` | 19003 | yes | `--incremental` | `topics/process_data_Gemini.py` |

**One-shot workers** (`filescanner`, `rescan`, `postprocessing`) are spawned by their own IPC handlers, not the supervisor.

### Resolution order for the workers directory

```
1. process.env.SCL_WORKERS_DIR (dev override)
2. <process.resourcesPath>/workers/ (packaged build)
3. D:/Client-Side_Project/SCL_Demo/_exe/ (default dev path)
```

### FastAPI wrapper (`SCL_Demo/tools/worker_api.py`)

Each worker imports and calls `start_worker_api(default_port=N, default_status={...})`. It spawns a daemon thread running uvicorn + FastAPI on `127.0.0.1:<port>`. Two endpoints: `GET /health` (uptime) and `GET /status` (the worker's status dict, mutated via `set_status(key, value)` / `update_status(patch)`).

**Adoption status (2026-04-29):** all three workers build, run, and serve `/health` + `/status` cleanly. The earlier blocker had two layers (build-time missing venv deps, then a runtime path-resolution bug under PyInstaller `--onefile`). Both fixed in the SCL_Demo session of 2026-04-29 — see [docs/claude-handoff/06-pending-and-caveats.md item 1](claude-handoff/06-pending-and-caveats.md) for the full story. The new `tools/utils_paths.py::get_data_root()` resolver tries `SCL_DEMO_DATA_ROOT` env first (the supervisor sets it for packaged builds), then walks up from `sys.executable` for a `db_files/` ancestor (dev fallback), then a project-relative fallback for `python -m` runs. `keep_alive_until_signal()` keeps the FastAPI thread serving even if the primary watchdog job fails to start — so the supervisor sees a healthy-but-idle worker rather than a vanished one.

---

## 10. LLM layer

Three parallel subsystems sharing some primitives:

### Subsystem A — Classifier (legacy)

Path: `src/main/filters/`. Used by the Filter Workbench's "Classify with AI" feature. Per-provider `ClassifierAdapter`s in `filters/providers/{ollama,openai,claude,gemini,huggingface,lmstudio}.ts` (last two added v0.4.0) build a fixed classifier prompt internally (`prompts.ts::buildClassifierPrompt`) and parse the response into `ClassifiedFilename[]`. Tightly coupled to the classifier flow.

### Subsystem B — Generic completion (Round 1, 2026-04-28)

Path: `src/main/llm/completion/`. Any feature in the app can call:

```ts
const result = await api.llm.complete({
  messages: [
    { role: 'system', content: 'You are a concise assistant.' },
    { role: 'user', content: 'Summarize: ...' }
  ],
  // All optional:
  providerId,           // override default (LLM_Provider WHERE IsDefault='Y')
  modelName,            // override provider default (Models WHERE ProviderDefault='Y')
  temperature: 0.2,
  maxTokens: 1024,
  responseFormat: 'text' | 'json',
  feature: 'topic-rename'  // free-form tag persisted to LLM_Usage
})
// → { ok, content, model, providerName, latencyMs, usage: {tokensIn, tokensOut}, truncated, error }
```

Flow inside the dispatcher (`completion/index.ts`):

1. **Validate** `req` shape (defends against malformed IPC payloads)
2. **Resolve provider**: explicit `providerId` → row, else `WHERE IsDefault='Y'`
3. **Resolve model**: explicit `modelName` → row (fetches its modelId for usage logging), else provider's default, else adapter's hardcoded `defaultModel`
4. **Hoist system message**: helper extracts `role:'system'` entries from `messages` (merging multiple with `\n\n` if present), returns `{ system, rest }`
5. **Call adapter** with the per-provider request shape:
   - **OpenAI**: `POST /v1/chat/completions`. o-series detection (`/^(o\d+(-|$)|chatgpt-)/i`) swaps `temperature`+`max_tokens` for `max_completion_tokens`. JSON mode adds `response_format: {type: 'json_object'}`.
   - **Claude**: `POST /v1/messages` with `anthropic-version: 2023-06-01`. System content lands at top-level `system` field (not in messages). `stop_reason === 'max_tokens'` → `truncated: true`.
   - **Gemini**: `POST /v1beta/models/{m}:generateContent`. System hoisted to `systemInstruction.parts[].text`. `assistant` → `model` role rewrite. `responseMimeType: 'application/json'` only when JSON requested.
   - **Ollama**: `POST /api/chat` with `stream: false`. `ECONNREFUSED` rewrapped as friendly "Ollama unreachable — is the daemon running?".
   - **HuggingFace** (v0.4.0): `POST router.huggingface.co/v1/chat/completions`. OpenAI-compatible wire format — single HF token covers many models via the Inference Providers router. Default model `meta-llama/Llama-3.3-70B-Instruct`.
   - **LM Studio** (v0.4.0): `POST localhost:1234/v1/chat/completions`. OpenAI-compatible. No auth (local server). `ECONNREFUSED` rewrapped as friendly "LM Studio unreachable — is the local server running?".
6. **Log usage**: `INSERT INTO LLM_Usage` with `providerId`, `modelId`, `feature`, `tokensIn`, `tokensOut`, `latencyMs`, `ts`
7. **Return** typed `LlmCompleteResult`. Any unexpected throw becomes `{ok: false, error}` (outer try/catch).

### Model auto-discovery

`api.llm.discoverModels(providerId)` (Round 1 prequel) calls each provider's `/models` endpoint with the stored API key, parses the response, and replaces the rows in `Models` for that provider. This doubles as auth validation:

| Provider | Endpoint | Auth | Notes |
|---|---|---|---|
| Ollama | `GET /api/tags` | none | Returns `body.models[].name` |
| OpenAI | `GET /v1/models` | Bearer | Filters `^(gpt-\|o1-)` |
| Claude | `GET /v1/models` | `x-api-key` + version header | Falls back to a hardcoded list on 404 (older accounts) |
| Gemini | `GET /v1beta/models` | `x-goog-api-key` | Filters by `supportedGenerationMethods.includes('generateContent')` |
| HuggingFace (v0.4.0) | `GET huggingface.co/api/whoami-v2` (auth) + curated 10-model fallback | Bearer | Router doesn't expose a stable `/v1/models` listing; whoami validates the token, then we serve a curated set. `AllowAddModel='Y'` so users can paste any HF model ID manually. |
| LM Studio (v0.4.0) | `GET localhost:1234/v1/models` | none | Returns whichever model is currently loaded in LM Studio (typically one). |

`api.llm.testConnection` is now a thin wrapper around discovery (auth-passes-iff-discovery-succeeds).

### Subsystem C — LLM bridge for Python workers (v0.4.0)

Path: `src/main/llm/bridgeServer.ts`. A loopback `http.createServer` bound to `127.0.0.1:45123`, started at `whenReady` BEFORE the worker supervisor (so the supervisor's first spawn never races the bind syscall). Two endpoints:

- `GET /health` → `{ ok: true }`
- `POST /llm/complete` → wraps `complete()` from Subsystem B; body matches the `LlmCompleteRequest` type

Body cap: 1 MiB to defend against a misbehaving local process flooding the main process before `JSON.parse`. No auth: loopback-only binding is the access boundary, equivalent to read access on the local SQLite DB. Adding a shared secret would be ceremony.

The supervisor passes `ELECTRON_LLM_BRIDGE_PORT=45123` to spawned workers' env. The Python helper in [SCL_Demo/tools/electron_llm_client.py](D:/Client-Side_Project/SCL_Demo/tools/electron_llm_client.py) (uses stdlib `urllib`, no extra deps) reads that env, POSTs the request, and surfaces the result. Errors classify into `BridgeError` whose message text is parsed by the worker for retry semantics (`unreachable|timeout|connection` → tenacity retry as `NetworkError`; `rate limit|quota|429` → tenacity retry as `APIError`; everything else → fall back to `generate_fallback_metadata` for the affected file).

[topics/process_data_Gemini.py](D:/Client-Side_Project/SCL_Demo/topics/process_data_Gemini.py) was rewritten in v0.4.0: imports of `google.generativeai` and `genai.configure(api_key=API_KEY)` removed, `model = genai.GenerativeModel(...)` removed, `process_record_with_ai()` and `process_records()` no longer take a `model` parameter. The user's GUI provider choice now drives scan-time topic naming. (The `gemini_processor` filename + supervisor entry stayed put — renaming would have rippled through too much.)

### Test harness

Dev overlay → **LLM** tab is a Playground: provider+model dropdowns, system+user prompt textareas, temperature slider, max tokens, JSON toggle, Send button. Last 5 results displayed inline with content, model, providerName, latency, token counts, and truncated badge. Each Send writes a row to `LLM_Usage` with `feature='playground'`.

---

## 11. ExecEngine connection layer

**Round 2 (2026-04-28).** The Electron client is a Consumer Peer in the SCL ecosystem. ExecEngine V2 has documented a peer protocol but the only piece HTTP-implemented today is the SIS (Sign-In Service) on port 44450. The rest of the protocol (CBR / CBRM / CDREQ / CSCT messages on TCP Queue 44998/44999) is documented but not yet implemented in any client.

This round delivers everything client-side that doesn't depend on the future Queue transport: real working auth, type-stable message contracts, a connection-status surface, and a swap-point factory.

### Components

| File | Role |
|---|---|
| `src/main/execengine/sisAuth.ts` | HTTP client for SIS `/api/v1/auth/{signin,signout,verify}` + `/health`. Uses `electron.net.request` directly (not the providers/httpJson wrapper) for raw status-code visibility — signin returns 200 + `success: false` for bad creds vs. 4xx/5xx for server problems. |
| `src/main/execengine/authState.ts` | Module-scope state manager: persists `session_token + cp_id + master_id + expires_at` to `AdminData`; password is never stored. Single-flight signin guard. Listener channel for state changes. |
| `src/main/execengine/protocol.ts` | TypeScript type contracts for all 16 documented Queue messages: 8 outbound (CBR / CBRM / CDREQ / CMREQ / CSCT / CSMC / CSMS / CPSR) and 8 inbound responses (RBC / RBCM / CDRESP / CMRESP / TRSC / CRSC / MSCS / CPSRESP). Plus a `BackendNotReady` error class. **No transport** — types only. |
| `src/main/execengine/real.ts` | `RealExecEngineClient` extends `RealLocalExecEngineClient`. All methods currently call `super.<method>()` — JSDoc on each method documents the planned Queue protocol mapping. As individual Queue methods land, the relevant override here gets filled in. |
| `src/main/execengine/client.ts` | Factory: returns `RealExecEngineClient` if `state === 'connected'`, else `RealLocalExecEngineClient`. Cached, with cache invalidation triggered by the `onConnectionChange` listener. |
| `src/main/ipc/execengine.ts` | IPC handlers: `getStatus`, `setConfig`, `signIn`, `signOut`, `healthCheck`. |
| `src/renderer/features/settings/ExecEngineCard.tsx` | UI card on Settings page: connection-state badge, host/port editor, sign-in dialog, sign-out, health-check button. Polls status every 10s. |

### Connection state machine

```
not-configured ──set-config──▶ disconnected ──signin──▶ connecting ──┬──▶ connected
                                                                    │   (token persisted)
                                                                    │       │
                                                                    │       │ time passes...
                                                                    │       ▼
                                                                    │     expired ──signin──▶ connected
                                                                    │
                                                                    └──▶ error (lastError populated)
```

`'connected'` doesn't yet mean peer data is real — it means SIS auth is valid. The `IExecEngineClient` factory uses this state to swap clients, but until Queue transport lands, both clients return the same data (local SCLFolder + mock fallback).

### Boot-time token recovery

On every app boot, `initAuthState()` reads any persisted token from `AdminData`. If the local `expires_at` says it should still be valid, optimistically transition to `'connected'`; then `verifyPersistedToken()` fires async to confirm against SIS, downgrading to `'expired'` if SIS rejects. The brief window between optimistic and verified status is currently harmless (the `RealExecEngineClient` delegates everything to local) but flagged for the Queue-TCP phase.

### Security posture for the SIS connection

- Plaintext HTTP to `localhost:44450` by default. TLS is the deployment's responsibility (NGINX upstream).
- Username + password are sent as JSON body of `POST /signin`. Never persisted.
- Issued session token (SHA256 string, 24h) is persisted to `AdminData.ExecEngineSessionToken`. Same posture as LLM API keys.
- The token is **not exposed** to the renderer — only metadata (cpId, masterId, expiresAt, state). A `getSessionTokenForBackend()` helper exists for future Queue-TCP code to read it inside the main process.

---

## 12. Tooltip / help system

Two reusable primitives in `src/renderer/components/ui/`:

- **`HelpHint`** — small `?` icon (lucide `HelpCircle`) with an attached Radix tooltip. Drop in next to any label or heading: `<HelpHint label="..." size="xs|sm|md" />`.
- **`WithHint`** — wraps an existing button/label/badge so hovering it surfaces a tooltip without an extra icon.

Both use the existing `TooltipProvider` mounted at app root (`App.tsx`, 300ms delay).

The Header / Sidebar use a separate older **cursor-tooltip** component (`Tip` from `cursor-tooltip.tsx`) that follows the cursor — used for pinned chrome elements.

Coverage applied 2026-04-28 across every page (Dashboard, Folders, LLMs, Topics, Filter Workbench, Knowledge Map, Privacy, Community, Settings). Voice convention: **one short sentence on what it is, optionally a second on data-source / limitation**, and **explicitly call out synthetic data** so users don't over-trust placeholders.

---

## 13. System tray + window lifecycle

The app is **tray-resident**: clicking the X on the window hides it; the app keeps running with a tray icon. Real exit only happens via the tray menu's "Quit" entry (or `app.quit()` programmatically).

Components:
- `src/main/tray.ts` — `createTray()` builds the tray icon + context menu (Show / Hide / Quit). Force-resizes the loaded `nativeImage` to 16×16 because Windows 11's tray slot can't render the larger PNG-encoded ICO entries our multi-size icon ships.
- `src/main/window.ts` — `createMainWindow()` sets up the BrowserWindow with hide-on-close (intercepts `close` event and calls `win.hide()` instead, unless `markQuitting()` was called).
- `src/main/icon.ts` — `resolveAppIconPath()` shared helper that probes `process.resourcesPath/icon.ico`, `__dirname/../../resources/icon.ico`, and a couple of fallbacks. Both tray and window use it.

Bundled into the installer via `electron-builder.yml`'s `extraResources`:

```yaml
extraResources:
  - from: resources/icon.ico
    to: icon.ico
  - from: exe
    to: exe
    filter: ['**/*']
  - from: ../../../SCL_Demo/_exe
    to: workers
    filter: [root_watchdog.exe, topic_watchdog.exe, gemini_processor.exe]
  - from: ../../../SCL_Demo/db_files
    to: scl_db_seed
    filter: [SCLFolder_Publ.db, SCLFolder_Priv.db]
```

---

## 14. Build, package, install

All commands run from `src/src/`.

| Command | What it does |
|---|---|
| `npm install` | Installs deps + runs `postinstall: electron-builder install-app-deps` (rebuilds `better-sqlite3` against the bundled Electron's Node ABI) |
| `npm run dev` | electron-vite watch mode: builds main + preload to `out/`, serves renderer on Vite dev server at `http://localhost:5173`. Spawns Electron pointed at `out/main/index.js`. HMR for renderer. Main + preload rebuild + restart on change. |
| `npm run build` | Production build to `out/` (no installer) |
| `npm run build:win` | `electron-vite build` + `electron-builder --win` → NSIS installer + win-unpacked dir to `release-builds/` |
| `npm run typecheck` | Both TS projects (node + web) |
| `npm test` | vitest |
| `npm run test:e2e` | Playwright against the win-unpacked build |
| `npm run storybook` | Playwright-driven page screenshot capture → `storybook/` |

### electron-builder.yml summary

```yaml
appId: com.shortcut.studio
productName: ShortCut Studio
directories:
  output: release-builds
  buildResources: resources    # where electron-builder looks for installer-time icons
files: [out/**/*, package.json] # what goes into app.asar
extraResources:
  - resources/icon.ico → resources/icon.ico
  - exe/ → resources/exe/                     # SCL_Restart_PortIDs.exe + friends
  - SCL_Demo/_exe/{root,topic,gemini}_*.exe   # the 3 supervised workers
                                              # → resources/workers/
  - SCL_Demo/db_files/{config.json, ignore lists, SCLFolder_Publ/Priv.db, zine_mappings.json}
                                              # → resources/scl_data_seed/db_files/
                                              # (v0.4.0: copied to <userData>/scl_data/db_files/ on first launch)
  - vendor/ipfs/ → resources/extras/ipfs/     # v0.4.0: IPFS Kubo v0.41.0 (~41 MB)
  - vendor/nginx/ → resources/extras/nginx/   # v0.4.0: Nginx 1.26.2 (~2 MB)
asarUnpack: [resources/**, node_modules/better-sqlite3/**]
                                 # native module needs to be on real FS, not inside asar
win:
  target: [nsis]
  icon: resources/icon.ico
  signtoolOptions:
    publisherName: ShortCut Studio   # v0.4.0: cleaner SmartScreen UX, still unsigned
nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  include: build/installer.nsh    # v0.4.0: customFinish hook (see below)
```

### Vendored binaries (v0.4.0)

`vendor/{ipfs,nginx}/` is gitignored. Populated by [scripts/fetch-vendor-binaries.mjs](../src/src/scripts/fetch-vendor-binaries.mjs) which runs as the first step of `npm run build:win` (and `build:unpack`). Idempotent: skips re-download/extract if the on-disk `VERSION` sentinel matches the script's pinned version. Bump the IPFS / Nginx version constant in that script to refresh.

Currently dormant in the running app — IPFS allocation feature and ExecEngine HTTP/Nginx layer light them up in v2.

### Custom NSIS hook (v0.4.0)

[build/installer.nsh](../src/src/build/installer.nsh) defines a single `customFinish` macro: at end of install, MessageBox MB_YESNO asks the user whether to open download pages for Ollama / LM Studio. `/SD IDNO` makes silent installs (`Setup.exe /S`) default to "No" so unattended installs don't pop browser tabs. Yes opens both URLs via `ExecShell "open"`. The label is uniquified with `${__LINE__}` so it can't collide with future electron-builder template labels.

### Installer output

- `release-builds/ShortCut Studio-Setup-<ver>.exe` — NSIS installer. v0.4.0: ~237 MB (was ~180 MB at v0.3.1; +49 MB for IPFS + Nginx + new code)
- `release-builds/win-unpacked/ShortCut Studio.exe` — smoke-test target without installing
- `release-builds/latest.yml` + `.blockmap` — auto-update metadata (feed URL is currently `https://example.invalid/` placeholder)

**Code signing is disabled.** No EV/OV cert configured. Windows SmartScreen will warn on install. Expected for v1; owner needs to acquire a cert before public release.

---

## 15. Configuration & persistence

### Stored in SQLite (`AdminData`):

| Field | Default | Notes |
|---|---|---|
| `RecID` | 1 | Singleton row |
| `Localhost_Port` | 44999 | ExecEngine queue bus port (informational; not yet used) |
| `NumTopicThreshold` | 10 | Min files before AI proposes a new topic |
| `CPU_Perf_Threshold` | 50 | Pause heavy workers above this CPU % |
| `SetupCompleted` | 0 → 1 after first-run wizard | |
| `WelcomeOnStartup` | 1 | Show Welcome on launch |
| `ExecEngineSisHost` | `'localhost'` | **Round 2** SIS host |
| `ExecEngineSisPort` | 44450 | **Round 2** SIS port |
| `ExecEngineSessionToken` | NULL | **Round 2** 24h SHA256 token |
| `ExecEngineCpId` | NULL | **Round 2** assigned by SIS on signin |
| `ExecEngineMasterId` | NULL | **Round 2** assigned by SIS |
| `ExecEngineTokenExpiresAt` | NULL | **Round 2** epoch seconds |

Other tables (`LLM_Provider`, `Folder`, `PrivacyTerms`, `FilterPresets`, etc.) are user-editable via the UI.

### In-memory only (resets on every app restart):

- Mode: `'publ' | 'priv'` (defaults to `'publ'`)
- Auth state cached snapshot
- Worker statuses + log buffers
- Memory-resident SIS session token (mirror of `ExecEngineSessionToken`)
- React Query caches (renderer)

### Not persisted (intentional):

- Username / password for SIS sign-in (re-enter via dialog when token expires)
- LLM completion request payloads (only token counts go to `LLM_Usage`)
- Topic generation queue jobs in `OCR_Process` write but no consumer yet

---

## 16. Security posture

| Knob | Setting | Why |
|---|---|---|
| `contextIsolation` | `true` | Renderer can't reach main's globals |
| `nodeIntegration` | `false` | Renderer can't `require('node:fs')` |
| `sandbox` | `false` | Preload needs to use the typed contextBridge; sandbox would block it |
| Renderer CSP | `default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data: blob:; font-src 'self' data:` | Tight; `'unsafe-inline'` for styles is needed for some Tailwind class outputs |
| `setWindowOpenHandler` | denies `window.open`, routes to `shell.openExternal` | Prevents popups |
| IPC handlers | All registered via `ipcMain.handle` (typed); validate payload shape on entry for handlers that accept complex objects (e.g. `llm:complete`, `execengine:sign-in`) | TypeScript types don't survive the IPC boundary; explicit validation throws clean errors instead of crashing |

### Secret handling

- **LLM API keys**: plaintext in `LLM_Provider.API_Key`. CLAUDE.md notes this is by-design — they're on the user's machine, single-user threat model, and OS-keychain integration is deferred.
- **SIS session tokens**: same posture. Persisted plaintext in `AdminData.ExecEngineSessionToken`. 24h validity limits exposure window.
- **SIS passwords**: never persisted. User re-enters when token expires.
- **URL redaction in error logs**: `httpJson.ts` and the SIS auth client both strip `?key=`, `?api_key=`, `?token=` query params from URLs before embedding them in error messages.

### Code signing

Not configured. Expected; deferred until owner acquires an EV/OV cert.

---

## 17. What's real vs mocked

Honesty matters because the dashboard looks polished but a lot of cross-machine data is still synthetic. The audit as of 2026-04-28:

| Surface | Status | Source |
|---|---|---|
| **Folders / file types / privacy terms / super-categories** | ✅ Real | `loc_adm.db` |
| **LLM provider config + model auto-discovery** | ✅ Real | `loc_adm.db` + provider HTTP APIs |
| **LLM completion (Round 1)** | ✅ Real | `LLM_Usage` populated; works for all 4 providers |
| **Insights / per-folder health / Knowledge Map / Filters preview** | ✅ Real | SCLFolder DBs (read-only) |
| **Dashboard "Total files" + per-stage Scan/LLM/KM counts** | ✅ Real | SCLFolder Files table |
| **Dashboard "Δ this window" deltas** | ⚠️ Synthetic | Mock per-range curve until `ProgressSnapshots` is populated by a background timer (v1.5) |
| **Dashboard "References" tab** | ⚠️ Estimated | `LLM × 0.55 / 0.72` coefficient with "Est" badge — no SCL_Demo column for citation parsing |
| **Dashboard peer counts** | ❌ Always 0 | No peer source until ExecEngine Queue transport ships |
| **Active jobs panel** | ❌ Mock | Hardcoded 3-job list. Real job dispatch is Round 3 territory. |
| **IPFS status + allocation** | ❌ Mock | `MockExecEngineClient` returns `running: false, peerCount: 0`. UI is fully interactive but inert. |
| **Network summary card** | ❌ Mock + real DB sizes | Synthetic peer growth + AgentHub status; real on-disk file sizes via IPC |
| **Topic review queue** | ❌ Mock | Hardcoded 10 sample topics from `mock.ts` |
| **Topic distribution** | ❌ Mock | Hardcoded 15-topic chart |
| **ExecEngine SIS authentication (Round 2)** | ✅ Real | `localhost:44450` HTTP works; token persists |
| **ExecEngine peer/job/IPFS data over Queue** | ❌ Not wired | Protocol types defined; transport not implemented |
| **Background workers** | ⚠️ Spawned, broken | Supervisor is real and spawns the `.exe`s; the `.exe`s themselves crash on launch due to a Python venv dep gap (`psutil` missing) until SCL_Demo's build environment is fixed |
| **Errors DB** | ✅ Real | `errors.db` — captures from IPC, LLM, ExecEngine, workers, renderer. Visible in Settings → Errors. |

### Three-round backend-readiness initiative (status)

1. **Round 1 — Generic LLM completion surface**: ✅ shipped 2026-04-28
2. **Round 2 — ExecEngine connection layer (auth + types + skeleton)**: ✅ shipped 2026-04-28
3. **Round 3 — OCR_Process job dispatch loop**: queued. Will wire `topics:generate` (which currently inserts an `OCR_Process` row that nobody picks up) to actually queue work for `gemini_processor` via its `/command` HTTP endpoint, with status flowing back via worker `/status` updates.

---

## 18. Operational notes

### Dev session quick-reference

```sh
# Daily flow
cd src/src
npm run dev                          # Electron + watch mode

# After pulling new code that changed Electron version
npx electron-builder install-app-deps   # rebuild better-sqlite3

# Check what's in loc_adm.db
python -c "import sqlite3; con=sqlite3.connect(r'D:/Client-Side_Project/ShortCut_Studio/src/src/db_files/loc_adm.db'); print(con.execute('SELECT * FROM AdminData').fetchall())"

# Inspect errors.db
python -c "import sqlite3; con=sqlite3.connect(r'D:/Client-Side_Project/ShortCut_Studio/src/src/db_files/errors.db'); print(list(con.execute('SELECT id, source, severity, category, message FROM AppErrors ORDER BY ts DESC LIMIT 20')))"

# Build the installer (~5-10 min first time)
npm run build:win                    # → release-builds/ShortCut Studio-Setup-0.3.1.exe

# Smoke test packaged build without installing
release-builds/win-unpacked/ShortCut\ Studio.exe
```

### Common failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| `NODE_MODULE_VERSION mismatch` on startup | `npm rebuild` was run instead of `electron-builder install-app-deps` (rebuilds for system Node, not Electron's bundled Node) | `npx electron-builder install-app-deps` (or delete `node_modules/better-sqlite3/build/Release/better_sqlite3.node` then re-run) |
| Tray icon blank | `icon.ico` missing from `process.resourcesPath` (packaged) or path resolution wrong (dev) | Check console for `[tray] icon at ...` warning. `resolveAppIconPath()` probes 4 locations. |
| "Auth failed" on Refresh models | Wrong API key, or provider's `/models` endpoint is gated (Anthropic 404 → fallback list path triggers) | Re-paste key; check `console.log` in main process for redacted URL + status |
| Diagnostics shows workers as "stopped" | The `.exe` crashed at startup due to missing Python deps in SCL_Demo venv | `cd D:/Client-Side_Project/SCL_Demo && .venv/Scripts/Activate.ps1 && pip install <missing-dep>`, rebuild |
| SCLFolder "no data yet" after a real scan | App started before SCL_Demo populated the DB | App falls back to mock; refresh after the DB exists |
| ExecEngine card stuck on "Disconnected" / "Error" | SIS not running or wrong port | Check `localhost:44450/api/v1/health` returns 200; "Health check" button surfaces network error |

### Known watch-items

- `OCR_Process` is populated by `topics:generate` but nothing consumes the rows → Round 3.
- `ProgressSnapshots` schema exists; nothing writes to it → v1.5 (real per-stage deltas).
- `LLM_Usage` is now populated by Round 1 but nothing READS it for analytics → v1.5 dashboard.
- Auto-update feed URL is `https://example.invalid/updates/` placeholder → activate when first signed release ships.
- The `folders:health` IPC channel has a handler but no preload bridge — orphaned. Called via `folders:list` indirection instead. Cleanup-eligible.

### How to extend safely

Adding a new IPC channel: keep the four touchpoints in sync (constant + handler + preload + api.ts type). Run `audit-ipc` skill afterwards.

Adding a new feature page: create `features/<name>/<Name>Page.tsx`; add the route in `App.tsx`; add the sidebar entry in `Sidebar.tsx::SECTIONS`. Use React Query for data; never `useEffect + fetch`.

Adding a new SQLite migration: append an idempotent block to `migrations.ts` (`CREATE TABLE IF NOT EXISTS` for new tables, `try { ALTER TABLE … ADD COLUMN } catch {}` for additions to existing tables). Migrations run on every boot; design for re-entrancy.

Calling LLMs from a new feature: use `api.llm.complete({ messages, feature: '<your-feature>' })`. The `feature` tag persists to `LLM_Usage` for per-feature analytics. Don't talk to provider APIs directly — go through the dispatcher.

### Where to find things

| Need to do… | Look at |
|---|---|
| Trace an IPC call | `IpcChannel.<name>` in `src/shared/ipc-channels.ts`, then handler in `src/main/ipc/<domain>.ts` |
| Understand a DB schema | `src/main/db/migrations.ts` |
| Know what's mock vs real | This document, section 17 |
| Add a new LLM-using feature | Use `api.llm.complete(...)`, see Round 1 in section 10 |
| Diagnose a worker | Settings → Diagnostics (when `SHOW_DIAGNOSTICS=true`) or Dev overlay → Workers tab |
| See live LLM behavior | Dev overlay → LLM Playground tab |
| Inspect SIS connection state | Settings → ExecEngine connection card |

---

**End of architecture document.** For session-specific narrative (decisions made, why, who said what), see `docs/claude-handoff/`. For agent instructions and skills configuration, see `CLAUDE.md`.
