# 05 — Features built (per-feature status)

Every feature, what works, what's stubbed, and the files that implement it.

## 1 · App shell

**Status: ✓ built, usable.**

Shell is the chrome around every route: header at top, sidebar on left, main content in the middle, info section at bottom.

| File | Responsibility |
|---|---|
| `src/renderer/components/layout/AppShell.tsx` | Layout container — flex-column with header + flex-row body (sidebar + main) + footer info section |
| `src/renderer/components/layout/Header.tsx` | App name + version, Public/Private mode toggle (wired to `api.mode.get/set`), theme toggle (light/dark) |
| `src/renderer/components/layout/Sidebar.tsx` | 7 route links with lucide icons; `NavLink` from react-router-dom handles active state |
| `src/renderer/components/layout/InfoSection.tsx` | Rotating carousel of placeholder messages, collapse/expand button, prev/next |

**Pending polish:**
- Draggable divider on the info section (currently a fixed 32 vs. 128 px toggle).
- Real rotating-message content from `resources/info-messages.json` (owner supplies the 15-25 messages).
- Sidebar collapse-to-icons-only state.

---

## 2 · Folders (content detection)

**Status: ✓ v1 complete.**

Two-section page: **File types** (chip toggles) + **Indexed folders** (include/exclude table).

### Backend

| File | Content |
|---|---|
| `src/main/ipc/folders.ts` | `FoldersList`, `FoldersAdd`, `FoldersRemove`, `FoldersUpdatePath`, `FoldersPickDirectory` |
| `src/main/ipc/fileTypes.ts` | `FileTypesList`, `FileTypesToggle`, `FileTypesAdd`, `FileTypesRemove` |

**Schema:** `Folder` table (`Path` widened to `TEXT`), new `FileTypeFilters(extension, label, enabled, sortOrder)` table. Seeds: PDF/EPUB/MOBI enabled, AZW3/DJVU disabled.

**Add-folder logic** mirrors the old ElectronAdmin2 behaviour: if a parent folder is already `Include='Y'`, the new folder is added as `Include='N'` (exclude). Standalone parents are `'Y'`.

### Renderer

`src/renderer/features/folders/FoldersPage.tsx`:
- `FileTypesCard` — chips with on/off state, "+" input to add an arbitrary extension
- `FoldersCard` — inline-editable paths (pencil icon), remove button, folder picker via `pickDirectory`
- Green rows for `Include='Y'`, amber rows for `Include='N'`

**Not yet:**
- Drag-to-reorder rows (plan called for it — deferred; ordering is path-alphabetical via the SQL).
- Per-folder progress bars (will land with real scanner integration — see worker supervisor).

---

## 3 · LLMs

**Status: ✓ v1 complete.** This is the most feature-rich page outside Dashboard.

### Backend

| File | Content |
|---|---|
| `src/main/ipc/llm.ts` | `LlmListProviders`, `LlmUpdateKey`, `LlmListModels`, `LlmAddModel`, `LlmSetDefaultModel`, `LlmTestConnection` |

`LlmTestConnection` issues a `GET` to the provider's `API_Host` via `electron.net`. Returns `ok` + `latencyMs` or `error`. It's a reachability check, not a completion call — good enough for the "is the URL + auth working?" signal.

**Schema:** `LLM_Provider(API_Key)` widened to `TEXT` (was `VARCHAR(50)` and silently truncating real keys). Pre-seeded with Ollama / OpenAI / Claude / Gemini.

### Renderer

`src/renderer/features/llm/LlmPage.tsx`:
- **Privacy callout** at the top — the owner's "don't share expertise with commercial LLMs" message
- **Provider cards** — API key input with show/hide (eye icon), badge for key-set state, "Default" badge if `IsDefault='Y'`, Test button with loading spinner + success/failure result line
- **Onboarding modal** — `OnboardingDialog.tsx` renders canned step-by-step guides for OpenAI, Claude, Gemini, Ollama. Each step can have an "Open in browser" link button (uses `api.app.openExternal`).
- **Ollama** is specially treated — no key needed; Test button pings the host directly.

`src/renderer/features/llm/provider-onboarding.ts` — the canned `PROVIDER_GUIDES` dict. Steps hand-written, with real signup URLs and key-format hints.

**Not yet:**
- Usage / cost visibility (v1.5 — `LLM_Usage` table exists but nothing writes to it yet).
- Per-feature provider override picker (topics → Gemini, classify → OpenAI, etc.). Architecture supports it; UI doesn't expose it yet.
- Model list editing UI. The `Models` table is populated (Ollama has pre-seeded models) and handlers exist (`listModels` / `addModel` / `setDefaultModel`), but the Models list isn't surfaced on the page yet.

---

## 4 · Topics

**Status: ✓ v1 complete with stubs where appropriate.** Cleanly degrades if SCL_Demo hasn't scanned anything yet.

### Backend

| File | Content |
|---|---|
| `src/main/db/scl-folder.ts` | `openSclFolderDb()` + `withSclFolderDb()` — read-only connections to SCLFolder_{Publ,Priv}.db, returning `null`/`fallback` if file doesn't exist |
| `src/main/ipc/topics.ts` | `TopicsList` (joins SCL_Demo DB's `TopicNames` with loc_adm's `TopicSuperCategoryMap`), `TopicsGenerate` (enqueues an `OCR_Process` row — real worker call deferred), `TopicsReview`, `TopicsApprove` (stubs until gemini_processor worker wiring) |
| `src/main/ipc/superCategories.ts` | Full CRUD on `SuperCategories` + `assign` / `unassign` on `TopicSuperCategoryMap` |

**Schema:** `SuperCategories(SuperCategoryID, Name UNIQUE)` + `TopicSuperCategoryMap(topicName, superCategoryId FK ON DELETE CASCADE)`. Map is in `loc_adm.db` — does NOT modify SCL_Demo's DB. SCL_Demo remains authoritative for topic NAMES; only the grouping metadata lives locally.

### Renderer

`src/renderer/features/topics/TopicsPage.tsx` layout:
- **Top-right: "Generate topics" button** — calls `api.topics.generate()` which queues an `OCR_Process` row. Real worker invocation when gemini_processor adopts the FastAPI wrapper.
- **Main grid (3 columns):**
  - `TopicBrowser` (spans 2 cols): empty state if no scan DB; otherwise groups topics into "Unassigned" + one group per super-category. Topic chips are draggable + clickable (click opens an assign menu). Drop zones are the super-category containers.
  - `ReviewQueue`: empty-state card ("nothing to review yet — suggestions land here after the Gemini processor runs").
- **Bottom: `SuperCategoryManager`** — full create/rename/delete of super-categories.

**Not yet:**
- Topic chip → file list drill-down. Mockup had it; design wasn't specced for v1.
- `.lnk` shortcut regeneration on super-category rename (planned in the plan's feature spec; needs postprocessing.exe wiring).
- Real review queue items (blocked on gemini_processor emitting review items — currently the handler returns `[]`).

---

## 5 · Dashboard — Progress Glass (flagship)

**Status: ✓ v1 complete with synthetic peer data.**

### Renderer components

| File | Responsibility |
|---|---|
| `src/renderer/features/dashboard/DashboardPage.tsx` | Page layout: time-range bar, Progress Glass card, stat/delta card, active jobs panel |
| `src/renderer/features/dashboard/ProgressGlass.tsx` | SVG beaker with two stacked liquid fills (local blue, peer teal), smooth transitions |
| `src/renderer/features/dashboard/TimeRangeBar.tsx` | Segment-style button group: 12h / 24h / 2d / 5d / 10d / All |

### How it draws

180×320 SVG viewport. A `<clipPath>` defines the beaker silhouette (neck + shoulder + body + rounded bottom). Two `<rect>` fills inside the clip:
- **Local** (blue): bottom layer — `y = innerBottom - localHeight`, height = `localHeight`
- **Peer** (teal): stacked above — `y = innerBottom - localHeight - peerHeight`, height = `peerHeight`

CSS transitions on `y` and `height` (600 ms ease). Subtle ripple accent at the top of each liquid layer. Glass outline drawn on top, plus a shine highlight on the left. Center-text shows total percentage; small label underneath shows "X / Y".

Legend under the glass: two colored squares labelled Local / Peer.

### Data source

`api.progress.summary(range)` + `api.progress.jobs()` — both polled every 3 s via React Query. Data comes from `MockExecEngineClient`:
- **Local** grows linearly with elapsed runtime
- **Peer** is a sine wave + linear baseline — looks alive, deterministic
- **ETA** is a naive extrapolation from the current delta

### Active jobs panel

Below the Glass, showing a list of `Job` entries from `listJobs()`. Each row: status-icon-in-circle (running = spinning loader, queued = play icon, paused = pause icon, failed = alert), label, inline progress bar if `progress` present, "log" button (no handler yet).

**Not yet:**
- Historical interpolated line chart when range=All (v1.5 — `ProgressSnapshots` table exists, nothing populates it).
- ETA from real data (currently based on synthetic sine wave).
- Job log drill-down modal (button exists, handler is stub).

---

## 6 · Community (IPFS / P2P)

**Status: ✓ UI complete, backend stubbed.**

### Backend

| File | Content |
|---|---|
| `src/main/ipc/ipfs.ts` | `IpfsStatus`, `IpfsSetAllocation` — delegates to `getExecEngine()` |

All calls go through `IExecEngineClient`, which in v1 is `MockExecEngineClient` returning `running: false`, `peerCount: 0`, `minAllocationGb: 8`, empty byte counts.

### Renderer

`src/renderer/features/community/CommunityPage.tsx`:
- **Banner** at the top explicitly stating "not wired to backend yet"
- **Status tiles** (3): peers / stored / shared
- **Disk allocation** card — range slider (min=8 GB default, max=500), drive picker (disabled input placeholder)
- **Persuasion cards** — "dedicate a full drive" + "need more storage?" with disabled eShop link button

**Not yet:**
- Real drive picker (needs OS drive enumeration + selection dialog)
- Real peer count / storage bytes (waiting on ExecEngine integration)
- Affiliate eShop URLs (owner supplies)

---

## 7 · Privacy (terms editor)

**Status: ✓ v1 complete.**

### Backend

`src/main/ipc/privacy.ts` — `PrivacyListTerms` / `PrivacyUpdateTerms`. Only the user-source terms are mutable; system-source is replaced atomically by `updateTerms` (delete-then-insert user rows only).

**Schema:** `PrivacyTerms(id, term UNIQUE, source 'system'|'user')`. Pre-seeded system terms: `personal, private, confidential, draft, unreleased, ssn, passport`.

### Renderer

`src/renderer/features/privacy/PrivacyPage.tsx`:
- **System defaults card** — read-only locked chips (secondary badge variant)
- **Your terms card** — add input + button, existing user terms as chips with inline remove

**Not yet:**
- Integration with scanner. The terms sit in the DB; no scanner consumes them yet. Planned: when scanner adopts the FastAPI wrapper, the scan worker will check path matches against this table and route matches to `SCLFolder_Priv.db`.

---

## 8 · Settings (paths + admin values + diagnostics)

**Status: ✓ admin values + diagnostics work. Paths stubbed.**

### Renderer sections

1. **Paths card** — shows the current values of the hidden AppData content folder and the Desktop search folder. Both have disabled **Move…** buttons. A helper paragraph explains: "Move requires full implementation (copies content + updates shortcuts + app restart). Wired up in a later task."
2. **Admin values card** — three Input fields (Localhost_Port, NumTopicThreshold, CPU_Perf_Threshold) tied to the `AdminData` row in loc_adm.db via React Query. Save button appears only when there are unsaved changes.
3. **Diagnostics card** (hidden by default, click "Show") — per-worker row with status icon/text, restart count, **Tail log** button (shows last 200 lines in a `<pre>` below), **Restart** button (calls `api.diagnostics.restartWorker(name)`).

### Backend

| File | Content |
|---|---|
| `src/main/ipc/settings.ts` | `SettingsGet`, `SettingsUpdate` — AdminData row 1 |
| `src/main/ipc/diagnostics.ts` | `DiagnosticsWorkers`, `DiagnosticsRestartWorker`, `DiagnosticsTailLog` |

`Diagnostics` reaches into the worker supervisor (see `src/main/workers/supervisor.ts`) — `getWorkerStatuses()` returns the in-memory list of `WorkerHandle`s, `tailWorkerLog` slices the ring buffer.

**Not yet:**
- Move-folder flow (owner-critical but deferred — needs filesystem copy + restart prompt + path persistence).

---

## 9 · Worker supervisor + Python FastAPI wrapper

**Status: ✓ supervisor-side complete. Worker-side adoption pending (needs SCL_Demo .exe rebuilds).**

### Supervisor (`src/main/workers/supervisor.ts`)

- Reads `SUPERVISED_WORKERS` from `config.ts`, spawns each with `WORKER_HEALTH_PORT` env var injected
- stdout + stderr captured into a per-worker ring buffer (400 lines)
- On exit: if exit code ≠ 0 and restart count < 5, schedule restart with `2_000 * 2^n` ms backoff (capped at 30 s)
- Every 10 s, pings `/health` on each worker; updates `lastHealthCheck` timestamp (failure is non-fatal — workers without the wrapper don't respond)

### FastAPI wrapper (`D:/Client-Side_Project/SCL_Demo/tools/worker_api.py`)

Thin module workers import:
```python
from tools.worker_api import start_worker_api, set_status, update_status
start_worker_api(default_port=19001, default_status={ 'worker': 'root_watchdog' })
# later, as work progresses:
set_status('current_folder', target_folder)
```

Spawns a daemon thread running uvicorn + FastAPI. Exposes `/health` (uptime) and `/status` (worker's status dict).

Integration guide at `SCL_Demo/tools/WORKER_API_INTEGRATION.md` — explains PyInstaller `hiddenimports` for uvicorn, rebuild order, and how to verify a worker has been wired.

**Not yet:**
- Actual adoption by SCL_Demo workers. Each worker (`root_watchdog`, `topic_watchdog`, `gemini_processor`) needs ~3 lines of code added + a PyInstaller rebuild. Diagnostics panel shows workers as `stopped` until they're rebuilt with the wrapper.
- Bundling workers into the installer. `electron-builder.yml`'s `extraResources` currently only copies `exe/` (LocalHostTools binaries). To bundle `SCL_Demo/_exe/` into the installer, add another `extraResources` entry pointing at it.

---

## 10 · NSIS installer

**Status: ✓ builds successfully.**

### Config
`src/src/electron-builder.yml`:
- `appId: com.scl.admin`
- `productName: ShortCut Studio`
- Output: `release-builds/` (NSIS .exe at root, `win-unpacked/` alongside for smoke testing)
- `extraResources` copies `exe/` into the bundled app's `resources/exe/`
- `asarUnpack` unpacks `resources/**` and `node_modules/better-sqlite3/**` (native module needs to live on the real filesystem, not inside asar)
- NSIS options: `oneClick: false`, `allowToChangeInstallationDirectory: true`, `createDesktopShortcut: true`

### Output
- **Installer:** `release-builds/ShortCut Studio-Setup-0.2.0.exe` (≈115 MB)
- **Unpacked:** `release-builds/win-unpacked/ShortCut Studio.exe` + resources tree

### Known caveats

- **Code signing skipped** — no EV/OV certificate configured. Windows SmartScreen warns on first install. Expected; owner acquires cert before public release.
- **Auto-update feed URL is a placeholder** (`https://example.invalid/updates/` in `electron-builder.yml`) — electron-updater is wired but inactive.
- **Icon must be ≥256×256** — the original 240×240 icon was rejected by electron-builder's NSIS step. Current `resources/icon.ico` has 256/128/64/48/32/16 sizes (generated via Python PIL).

---

## Features NOT built (yet)

These were in-scope for later phases and intentionally skipped for v1:

- **Content-based classification** (v1.5) — detect doc type (paper/book/report/receipt) via LLM. `Files.DocCategory` column reserved.
- **Custom rules engine** (v2) — "if filename matches *_draft*, tag as draft"-style DSL.
- **Historical progress line chart + ETA from real data** (v1.5) — requires `ProgressSnapshots` population at 4-6 h intervals.
- **Remote-fetched Info Section content** (v1.5) — currently hardcoded in `InfoSection.tsx`; will move to `resources/info-messages.json` → remote fetch endpoint.
- **Auto-update activation** (v1.5) — feed URL needs to point at a real endpoint (GitHub releases, custom server, etc.).
- **Real ExecEngine integration** (v2) — Consumer Peer protocol against Agent Hub HTTP endpoint (pending ExecEngine's FastAPI layer).
- **Full manual topic CRUD** (v2) — create from scratch without LLM, split, merge.
- **LLM usage / cost visibility** (v1.5) — `LLM_Usage` table exists, no instrumentation yet.
