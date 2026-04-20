# 02 — Approved plan (verbatim copy)

This is a copy of the plan file that was approved before any code was written. The original lives at `C:/Users/harrycabrera/.claude/plans/okay-here-are-the-dapper-clarke.md` (outside the repo). Copied here so a new Claude session reading the repo has it at hand.

**Status:** Approved by user → ExitPlanMode called → all 12 implementation steps executed between 2026-04-20 14:00 and 16:30 Manila time. Deviations from the plan (there are a few — mostly scope-preserving simplifications for stubbed pieces) are noted in [05-features-built.md](05-features-built.md) and [06-pending-and-caveats.md](06-pending-and-caveats.md).

---

# Plan — Unified SCL_Admin Client (Centralized UI/UX)

## Context

`D:/Client-Side_Project/` currently has **two separate desktop apps** plus assorted background services:

- **ElectronAdmin2** (Electron + Bootstrap 4 + jQuery, ~1400 LoC) — folder include/exclude, LLM config, broken progress tab, settings. Users open this for admin work.
- **SCL_Demo** (PySide6 + 7 PyInstaller `.exe` workers) — scanning, Gemini topic generation, public/private DB browsing, watchdogs.
- **LocalHostTools** (3 Flask services on ports 18866/18877/18899) — file open, folder browse, topic lookup.
- **nginx** (port 18888) — static server, no frontend yet.

Users currently must run multiple programs to do one workflow. The UI looks dated and none of the four core problem areas (content detection, progress monitoring, topic management, LLM interfaces) have usable UX — none are **testable** in their current state.

**The owner's vision** (`UI_UX_For_SCL_Admin_Prompt_EW_26_04_18.docx`) reframes this product as:
- An **admin/monitor interface** for researchers / experts who scan their eBook libraries (PDF, EPUB, MOBI)
- Backed by **ExecEngine** (distributed P2P task scheduler at `D:/ExecEngine/`) — documents processed once globally across peer machines, results shared via IPFS
- A **community give-and-take model** — user shares CPU + disk (IPFS) in return for vastly faster global processing
- Privacy-first — remote LLMs only for busy-work; the signature **Progress Glass** engagement feature keeps users returning

**Goal of this plan:** Build one centralized client-side app (`SCL_Admin`) that replaces ElectronAdmin2 + SCL_Demo GUI and wraps the existing Python workers. Clean, modern UX for researchers. Wires for ExecEngine integration are in place but stubbed — real P2P integration follows when ExecEngine's FastAPI/Nginx layer ships.

---

## Tech Stack (decisions locked)

| Layer | Choice | Why |
|---|---|---|
| Shell | **Electron** (latest stable) | User decision. Reuses existing Electron familiarity. |
| Renderer | **React + Vite** | Modern, fast HMR, React ecosystem for shadcn/ui. |
| Styling | **Tailwind CSS + shadcn/ui** | Industry standard, dark mode built-in, design tokens, polished component primitives. |
| State | **Zustand** (light) + React Query (server state) | Simple, no Redux boilerplate. React Query handles polling ExecEngine. |
| IPC | **Electron `contextBridge` + typed `ipcRenderer.invoke`** | Upgrade from current `.send`/`.on` pattern. Promise-based, type-safe. |
| Workers | **Keep SCL_Demo's 7 PyInstaller .exes** as headless subprocesses | Battle-tested. Don't reinvent. |
| Worker IPC | **Thin FastAPI wrapper on each worker** (localhost, random port) | Structured status instead of stdout-parsing. One new Python module shared by all workers. |
| DB | **SQLite** (existing `loc_adm.db`, `SCLFolder_Publ.db`, `SCLFolder_Priv.db`) | Reuse; migrate schema gaps (add `OCR_Process`, widen `Path` / `API_Key` columns). |
| ExecEngine client | **TypeScript interface + in-memory mock** in v1; swap to real CP client in v2 | Wires the UI; zero backend dependency for v1. |
| Packaging | **electron-builder** → NSIS installer | Professional install experience. |
| Auto-update | **electron-updater** (wired in v1, activated in v1.5) | Ship the plumbing, turn on later. |
| Testing | **Vitest** (unit), **Playwright** (E2E Electron) | Standard React/Electron toolchain. |

---

## App Architecture

**In-place rewrite of `D:/Client-Side_Project/ElectronAdmin2/`.** The current `src/src/*` contents (Bootstrap + jQuery renderer, vanilla-JS main) get deleted except for `icon.ico` and `db_files/`. The new React + Vite + TypeScript structure lays down on top. The folder will be renamed to a final product name once one is chosen.

(The final on-disk layout is documented in detail in `04-architecture.md` — the plan's tree diagram matches reality with one minor rename: the `shell/` feature folder became `layout/` under `components/` since the shell is shared chrome, not a per-route feature.)

**Key design principles:**
- **Main process** owns: window/tray lifecycle, SQLite, worker supervision, ExecEngine client, filesystem access.
- **Renderer** owns: ALL UI. No DB access, no filesystem — everything goes through typed IPC.
- **Workers** (Python `.exes`) are supervised subprocesses. Main spawns them at app start, supervisor restarts on crash. Each worker exposes a small FastAPI health/status endpoint on a random localhost port; main queries it.
- **ExecEngine client** is an interface with two implementations (mock / real). Feature code depends on the interface — no `if (v1)` branches.
- **All types shared** between main and renderer via `shared/` folder. No stringly-typed IPC channels.

---

## UI/UX Framework

### Navigation shell
Left sidebar (collapsible) + top-bar + main content area + bottom info section (draggable divider). Not tabs — sidebar with routes. Sections:

1. **Dashboard** — Progress Glass + at-a-glance stats (home screen)
2. **Folders** — Include/exclude rules, file-type filters
3. **Topics** — Browse, trigger generation, review queue, super-category tree
4. **LLMs** — Provider config, test connection, usage, onboarding modal
5. **Community** (IPFS/P2P) — GB allocator, drive picker, peer status *(stubbed v1)*
6. **Privacy** — Private terms manager, privacy-aware filter draft
7. **Settings** — Paths (movable folders), mode (Public/Private), theme, diagnostics

**Public/Private mode toggle** lives in the header, always visible. Switches active DB across all features instantly.

### Info Section (bottom panel)
- Rotating carousel of **15–25 messages** (content TBD — owner supplies)
- 5 messages are **product/subscription callouts**; these swap to feature-usage descriptions once user has a subscription
- Draggable horizontal divider to collapse/expand
- Message source: JSON file bundled with app in v1 (`resources/info-messages.json`); remote fetch added in v1.5

### Theme
- **Light + dark mode**, user-toggleable. Dark default for researcher audience.
- Tailwind design tokens → shadcn/ui theme system. Define brand palette up front (owner TBD — placeholder palette in plan).
- Typography: Inter (sans) + JetBrains Mono (data/code contexts).

---

## Feature Specifications

*(Per-feature status as actually built is tracked in `05-features-built.md`.)*

### 1. Content Detection (Folders)
**v1 (must):**
- Folder include/exclude (table with drag-to-reorder, inline path edit, nested indicators)
- File-type filters (PDF / EPUB / MOBI + extensible list, chip-style toggles)
- Schema fix: widen `Folder.Path` from `VARCHAR(50)` → `TEXT`

**v1.5:** Content-based classification — detect doc type (paper/book/report/receipt). LLM call with a classification prompt. Falls back to rules-based (filename heuristics) if no LLM configured. Results in `Files.DocCategory` (new column).

**v2:** Custom rules engine — simple DSL ("if filename matches X, tag as Y"). Advanced panel, hidden by default.

### 2. Progress Monitoring (Dashboard + Progress Glass)
**v1:** Progress Glass (flagship), job queue view, per-folder progress bars. Data source: polls SQLite for scan/topic counts; polls worker FastAPI endpoints for live job status; peer data **stubbed** with synthetic numbers.
**v1.5:** Historical interpolated line chart (every 4-6h data point stored in a new `ProgressSnapshots` table); ETA projection.
**v2:** Real peer data once ExecEngine CP client lands.

### 3. Topic Management
**v1:** Browse (tree view), Trigger generation (button on folder/selected files → gemini_processor.exe worker), Review & approve queue (accept/reject/rename/merge, on accept .lnk shortcuts materialize), Super-category hierarchy (drag-drop, renames bulk-apply to shortcut folder structure). New `SuperCategories` table + `TopicNames.SuperCategoryID`.
**v2:** Full manual CRUD — create topic from scratch without LLM, split/merge existing.

### 4. LLM Interfaces
**v1:** Provider list (Ollama/OpenAI/Claude/Gemini, pre-seeded), schema fix `API_Key VARCHAR(50)` → `TEXT`, per-job provider picker, test-connection button, onboarding modal (step-by-step "get an API key" per provider), privacy warning callout.
**v1.5:** Usage / cost visibility (per-provider token counts in new `LLM_Usage` table).

### 5. IPFS / Community Layer *(stubbed v1)*
GB allocator slider (min from user's file size), drive picker, share toggle, peer status placeholder, persuasion cards + affiliate eShop link slots.
All UI functional; backend calls go through `IExecEngineClient` mock (predictable fake data).

### 6. Movable Folders
Hidden content folder (AppData): Settings "Move…" button → pick new location → app copies, updates config, prompts restart.
Desktop search folder: same treatment, updates `.lnk` generation path.

### 7. Privacy Terms
Simple list editor — system defaults read-only at top, user-added editable below. Terms fed into scanner's filter pass (path contains private term → marked private, routed to `SCLFolder_Priv.db`).

### 8. Service Management / Diagnostics *(hidden by default)*
Auto-start all workers on app launch (scanner, watchdogs, topic processor, Flask services).
Auto-restart on crash (supervisor catches exit, restarts up to N times with backoff).
Diagnostics panel in Settings → each worker's status + log tail + manual restart. Invisible to normal users; visible when something's wrong.

---

## ASCII Mockups

*(Included in the plan — Main Shell Layout, Dashboard with Progress Glass, Info Section bottom-panel pattern. Rendered via text boxes in the original plan file. Real-screen implementations live in `src/renderer/components/layout/` and `src/renderer/features/dashboard/`.)*

---

## Files to Reuse / Reference from Existing Codebase

**Reuse (wrap, don't rewrite):**
- `SCL_Demo/_exe/filescanner.exe`, `rescan.exe`, `root_watchdog.exe`, `topic_watchdog.exe`, `gemini_processor.exe`, `postprocessing.exe`
- `LocalHostTools/*.exe` (StartFile / TopicExplorer / TopicStat)
- `SCL_Demo/db_files/*.db` (with schema migration)

**Reference (read, don't copy):**
- Old `index.js` — IPC patterns worth upgrading to `.invoke`
- Old `custom.css` — color values for brand continuity (carried forward via CSS vars in `globals.css`)
- `SCL_Demo/scan/scan_api.py`, `vapp/main_app.py` — scan function signatures, mode-switching flow

**Added (small new Python module):**
- `SCL_Demo/tools/worker_api.py` — FastAPI wrapper exposing `/health`, `/status`, `/progress` for each worker. Bundled into each `.exe` build.

**Deleted at start of v1** (from old `ElectronAdmin2/src/src/`): `index.html`, `renderer.js`, `index.js`, `preload.js`, `custom.css`, `start.js`, `stop.js`, `main.js`, `jquery-3.7.1.min.js`, `info.html`, `loader.gif`, `tt._js`, `error.log`, old `package.json` / `package-lock.json` / `node_modules/`.

**Retire after v1 ships:** `SCL_Demo/vapp/` GUI (archive, keep scan/topics/watchdogs). Decision on `LocalHostTools/`: keep as separate `.exe` workers spawned by the Electron supervisor (default) or fold into SCL_Demo — left as-is.

---

## Implementation Phases

### v1 — Ship-able MVP
All core features working. Every one of the 4 problem areas becomes testable.

0. Back up `loc_adm.db`, clear `src/src/*` keeping only `icon.ico`, `db_files/`, `exe/`.
1. Project scaffold (Vite + Electron + React + Tailwind + shadcn + TypeScript)
2. Shell + navigation + theme + info-section skeleton
3. Folders feature
4. LLM feature (+ onboarding modal + test connection)
5. Topics feature (browse + trigger + review + super-categories)
6. Progress feature (Progress Glass + job queue, peer data stubbed)
7. IPFS/Community feature (UI complete, backend mocked)
8. Privacy feature
9. Settings (movable folders + diagnostics)
10. Worker supervisor + Python FastAPI wrapper module
11. NSIS installer build pipeline

### v1.5 — Polish & retention
- Content-based classification
- Historical progress line chart + ETA
- LLM usage/cost visibility
- Remote-fetched Info Section content
- Auto-update wiring

### v2 — Real distributed integration
- Swap `IExecEngineClient` mock for real CP protocol (pending ExecEngine FastAPI layer)
- Real peer liquid data in Progress Glass
- Full topic manual CRUD
- Custom rules engine for content detection

---

## Verification / Testing Plan

**Dev loop:** `npm run dev` (HMR), `npm test` (Vitest), `npm run e2e` (Playwright Electron).

**E2E scenarios to pass before release:** first-run, scan flow, topic review flow, mode switch, worker crash recovery, LLM test-connection, folder move.

**Owner feedback rounds:** Round 1 — app shell + Progress Glass + Info Section. Round 2 — Folders + LLM onboarding. Round 3 — full v1 walkthrough before installer build.

---

## Open Questions (owner to answer before release)

1. Info Section content — who writes the 15-25 messages?
2. Affiliate eShop links — which shops, attribution setup.
3. Subscription flow — free vs paid tier gating; payment provider.
4. Brand identity — logo, primary color, wordmark.
5. Code signing certificate — needs EV or OV cert.
6. ExecEngine CP protocol finalization — waiting on FastAPI layer.
7. The "second interface with much more granularity" referenced in owner's doc.
8. Privacy-enhanced draft interface image referenced in owner's doc.

---

## Assumptions

1. Windows only for v1.
2. Single installer bundles app + workers + (eventually) Kubo.
3. Data migration from existing DBs automatic on first launch; old installs kept for rollback.
4. Owner approves milestone prototypes.
5. Public/Private mode stays visible to the user.
6. Keep existing Gemini API-key workflow (paste key, stored in SQLite).
7. In-place rewrite of `ElectronAdmin2/`; folder rename deferred to later milestone.
