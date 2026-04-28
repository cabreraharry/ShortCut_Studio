# 06 — Pending work, caveats, and watch-items

If you're a future Claude session (or a human developer) about to add a feature or fix a bug, **read this before touching anything**. These are the traps.

## High-priority caveats (read first)

### 1. Worker .exe rebuilds — Python source adopted, build env still blocked (UPDATED 2026-04-28)

**Status: Python adoption complete; PyInstaller rebuilds fail on missing venv deps.**

The supervisor in `src/main/workers/supervisor.ts` spawns SCL_Demo's `.exes`. ALL pre-existing `.exe`s in `SCL_Demo/_exe/` (including the untouched `filescanner.exe`, `rescan.exe`, etc.) have been crashing on launch since May 2025 with `ModuleNotFoundError: No module named 'tools'` — confirmed against `_exe/root_watchdog.exe.bak`. So health pings haven't been "timing out silently" — the workers were never actually starting.

**Changes already applied to SCL_Demo (2026-04-28):**
- `start_worker_api(default_port=19001|19002|19003, default_status={...})` added to top of `main()` in `scan/multi_watchdog_manager.py`, `scan/topic_watchdog.py`, `topics/process_data_Gemini.py`
- Empty `__init__.py` added to `tools/`, `scan/`, `topics/` (was the silent root cause — PyInstaller dropped namespace packages)
- All three `_ps1/build_*_exe.ps1` updated: invoke as `python -m PyInstaller` (was using the system-Python `pyinstaller` shim, missing every venv-only dep) + uvicorn hiddenimports added
- Installed in `.venv`: `pyinstaller 6.20.0`, `fastapi 0.136.1`, `uvicorn[standard] 0.46.0`

**Still blocking the rebuild:**
- `psutil` (imported by `scan/watchdog_json_manager.py`) is not in the `.venv` — `root_watchdog` and `topic_watchdog` builds will fail
- Likely more deps missing further down the import chain. `requirements.txt` is UTF-16 encoded and outdated.

**To finish:**
1. `cd D:/Client-Side_Project/SCL_Demo && .venv/Scripts/Activate.ps1 && pip install psutil`
2. Run `./_ps1/build_root_watchdog_exe.ps1`, identify next missing dep, install, repeat until the smoke test (run the .exe with `WORKER_HEALTH_PORT=19001` and `curl http://127.0.0.1:19001/health` returns `{"ok":true}`)
3. Repeat for `topic_watchdog` and `gemini_processor`
4. `pip freeze > requirements.txt` to capture the working dep set
5. `_exe/*.exe.bak` safety copies left in `_exe/` — delete once new builds verified

### 2. Workers + seed DBs are now bundled into the installer (DONE 2026-04-28)

`electron-builder.yml::extraResources` now ships:
- `exe/` (LocalHostTools binaries) → `resources/exe/`
- `SCL_Demo/_exe/{root_watchdog,topic_watchdog,gemini_processor}.exe` → `resources/workers/`
- `SCL_Demo/db_files/SCLFolder_{Publ,Priv}.db` → `resources/scl_db_seed/`

`config.ts::resolveWorkersDir` already picks up `<resourcesPath>/workers/` as its first choice in packaged builds. `db/scl-folder.ts::sclDbDir` copies seed DBs from `resources/scl_db_seed/` to `userData/scl_db_files/` on first launch.

**Caveat:** the bundled workers are still the broken pre-2026-04-28 `.exe`s until item #1 above is unblocked. New builds drop in via the existing `extraResources` block — no further config change needed.

### 3. Progress Glass — local is REAL, peer still synthetic (UPDATED 2026-04-28)

`src/main/execengine/client.ts::getExecEngine()` now returns `RealLocalExecEngineClient` (`src/main/execengine/realLocal.ts`):
- `totalFiles` = `SELECT COUNT(*) FROM Files WHERE IgnoreFile='N'` against `SCLFolder_{Publ,Priv}.db`
- `processedLocal` = same query with `Probability > 0`
- `processedPeer` = 0 (no peer data source until ExecEngine HTTP layer ships)
- `remaining` = `totalFiles - processedLocal`
- `rangeLabel`, `deltaLocal`, `deltaPeer`, `etaDays`, `rangeBudget` — still come from the per-range mock curve until `ProgressSnapshots` is populated by a background timer (v1.5)

If no SCLFolder DB exists yet (fresh install pre-scan), falls back entirely to the mock so the dashboard isn't a wall of zeros.

**Forward path:** when ExecEngine's HTTP/FastAPI consumer-peer layer ships, replace `RealLocalExecEngineClient`'s `getProgressSummary` peer numbers with real reads. The other 9 mock-delegated methods (IPFS, network summary, topics review/distribution, etc.) need similar swaps then.

### 4. ExecEngine's HTTP layer doesn't exist yet

`D:/ExecEngine/` has a full TCP QUEUE bus on ports 44998/44999 but the documented FastAPI/Nginx consumer layer (at `V2/server_V2/ah_V2/`) is **not implemented**. See `D:/ExecEngine/V2/Agent_Hub_Integration.md` (reference memory at `C:/Users/harrycabrera/.claude/projects/D--Client-Side-Project/memory/reference_execengine.md`).

**Implications:**
- Don't try to call ExecEngine from v1. There's nothing listening for HTTP requests.
- The Consumer Peer protocol (CBR, CBRM, CDREQ, CSCT, etc.) is spec'd but only usable over raw TCP QUEUE today. Implementing a TCP/JSON client from the Electron main process is possible but fragile — wait for the FastAPI layer.
- When someone asks "why isn't IPFS actually doing anything?" — this is the answer. UI is done; backend isn't.

### 5. SCL_Demo does NOT currently integrate with ExecEngine

Despite references in `SCL_Demo/tools/` to names that also exist in ExecEngine (`backups.db`, `swarm.db`, `mq.db`), SCL_Demo is fully independent. `sender.py` / `listener.py` are for its own P2P swarm on ports 4498/4499, not for ExecEngine's QUEUE. No imports of ExecEngine code anywhere in SCL_Demo.

When the ShortCut Studio client eventually wires to ExecEngine, it's a fresh integration — not inherited from SCL_Demo.

### 6. `loc_adm.db` schema columns called `VARCHAR(50)` actually hold arbitrary-length text

SQLite ignores the VARCHAR length. The old ElectronAdmin2 migration created `API_Key VARCHAR(50)` and ran into trouble with the assumption rather than the storage — **existing rows** aren't truncated (SQLite never truncated), but reads assumed 50 chars. Our `migrations.ts` creates new tables with `TEXT` and doesn't alter the old ones. Impact: none at runtime, but if you're doing analytics on row sizes, don't trust the column-type declarations.

### 7. `.vscode/` is force-added despite being in `.gitignore`

Root `.gitignore` has `.vscode`. We force-added `launch.json / tasks.json / settings.json / extensions.json` because they're shared workspace config every developer should have. If you add new `.vscode/` files, you need `git add -f` again.

### 8. Path-move in Settings is disabled

The **Paths** card on Settings shows the hidden AppData folder and Desktop search folder with disabled Move buttons. The actual move is non-trivial:
- Copy existing content to the new location (could be tens of GB)
- Update the app's config so future writes go to the new path
- Update `.lnk` shortcuts in the Desktop search folder (currently SCL_Demo's `manageLink.py` writes these)
- Prompt the user to restart so watchers pick up the new paths

Deferred to a later task. Button stays disabled with explanatory text.

## Schema watch-items

### `OCR_Process` is populated by `TopicsGenerate` but nothing consumes it

`src/main/ipc/topics.ts::TopicsGenerate` inserts a row into `OCR_Process` when the user clicks **Generate topics**. That row sits there forever — no worker picks it up and processes it. The plan is: once `gemini_processor.exe` has adopted the FastAPI wrapper, the supervisor polls for queued `OCR_Process` rows with `Kind='topics'` and dispatches them.

For now, clicking the button creates a job row that shows up in the active jobs list (via `listJobs` which fabricates jobs from `MockExecEngineClient`). So there's visual feedback but no real work happens.

### `ProgressSnapshots` is declared but never written

`migrations.ts` creates `ProgressSnapshots(ts, cumulativeLocal, cumulativePeer)` for the v1.5 history line chart. Nothing writes to it yet. When v1.5 lands, a background timer in the main process should snapshot the current progress every 4-6 hours.

### `LLM_Usage` is declared but never written

Same story. v1.5 concern — instrument the LLM handlers to write token counts after each call.

## Known UI quirks

### Topic drag-drop works but the drop-zone highlight is subtle

`TopicsPage.tsx::TopicGroup` accepts drops via `onDragOver` + `onDrop` on the super-category containers. Works functionally. No visual "this is a drop target" state yet (a hover ring would be nice). Can be improved with `useState` on `isDragOver` + a class toggle.

### File-type chips have no per-folder scope

Chips toggle global file-type acceptance. If a user wants to scan PDFs in `/Papers/` but not in `/Books/`, there's no way to express that — it's a global setting. Plan called for folder-level file-type flags eventually; the `Folder` table would need a new column.

### Mode toggle invalidates ALL React Query caches

`Header.tsx::setMode.onSuccess` calls `qc.invalidateQueries()` with no key argument — nuclear refresh of every query. Simpler than tracking which queries depend on mode. Costs a few unnecessary refetches (settings, LLM providers, privacy terms don't actually change across modes). Revisit if it becomes a perf issue.

### The `src/src/` nesting is intentional

You'll notice the oddly-nested `ShortCut_Studio/src/src/` layout. That predates this rewrite — the pre-rewrite ElectronAdmin2 codebase had it, `.claude/skills` point at it, and fixing the nesting would mean re-pointing all those paths. Not worth the churn. Live with it; it's just a directory.

## Security TODOs

### Code signing

Windows SmartScreen will warn on installs of the NSIS `.exe` until the owner purchases an EV or OV code-signing certificate. `electron-builder.yml` currently has no `win.signingHashAlgorithms` / `certificateFile` config. Before public release:

1. Owner obtains certificate (~$300-$600/yr for OV, $600-$1200/yr for EV)
2. Configure electron-builder to sign via environment variables (`CSC_LINK` + `CSC_KEY_PASSWORD`) or the `certificateFile` / `certificatePassword` keys

### LLM API keys in SQLite

Stored in plain text in `loc_adm.db::LLM_Provider.API_Key`. This is by design (the user types them; they're on the user's machine; encryption-at-rest would need OS key-storage integration). Don't expose the DB file location in user-facing copy, and don't back it up to public destinations.

### CSP is tight but allows inline styles

`renderer/index.html` sets `style-src 'self' 'unsafe-inline'` because Tailwind utility classes produce inline style attributes in a few cases. `script-src 'self'` (no inline scripts). If you need to relax anything, think twice.

## Version bumps to be careful with

### Electron

The `postinstall` script runs `electron-builder install-app-deps` which rebuilds `better-sqlite3` for whatever Electron version is in devDeps. Any Electron bump → expect a rebuild to happen automatically on `npm install`. If the rebuild fails (missing MSVC Build Tools, typically), use the `rebuild-native` skill or run `npx electron-rebuild -f -w better-sqlite3` manually.

### React 19

We're on React 18. React 19 is out but some shadcn/ui primitives still list React 18 as the peer-dep upper bound. Upgrade when the ecosystem catches up.

### Tailwind v4

Tailwind v4 changed the config format (CSS-first instead of JS). shadcn/ui supports it, but our current `tailwind.config.js` is v3 style. Upgrading is a meaningful refactor — schedule it as a dedicated task.

## Performance watch-items

### Better-sqlite3 is synchronous

Every IPC handler that reads from the DB blocks the main process for the duration of the query. In practice our queries are tiny (< 10 ms on SSD) and there's no concurrency in the main loop that competes with them. If you ever run a slow query (especially joins against SCL_Demo's potentially large `Files` table), move it to `worker_threads`.

### React Query polling defaults

- Progress summary + jobs: 3 s
- IPFS status + workers: 5 s

These are fine for a local Electron app (no network cost), but they do mean the main process wakes up constantly. If the CPU profile shows the app is busy when idle, increase these intervals.

### Renderer bundle is 626 KB

Not small. The biggest contributors are React + React Router + @tanstack/react-query + lucide-react (which imports *many* icons). If bundle size becomes a concern, swap lucide-react for individual icon imports, and consider lazy-loading feature routes (`React.lazy` for each `features/<name>/*Page.tsx`).

## Things to NOT do

1. **Don't import `electron` in the renderer.** Context isolation will throw. Use `window.electronAPI`.
2. **Don't hardcode IPC channel strings** — always import from `@shared/ipc-channels`. Channel names may change.
3. **Don't write to `SCLFolder_{Publ,Priv}.db`.** SCL_Demo's scanner is the authority. The Electron app only reads.
4. **Don't add a new `.gitignore` for `.vscode/`.** It's already in the root .gitignore; we force-added specific files; new `.vscode/` files also need force-adding if they should be shared.
5. **Don't put secrets in `resources/info-messages.json`** (once that file exists). It's bundled into the app — anything in there ships to every user.
6. **Don't `tsconfig.json`-ify the root** — use the references pattern (root references tsconfig.node.json + tsconfig.web.json). Adding compilerOptions at the root level breaks both sub-projects.
7. **Don't run SCL_Demo's `vapp/` GUI anymore.** It's the legacy PySide6 UI. The new Electron app replaces it; leaving the old GUI runnable just confuses users.
