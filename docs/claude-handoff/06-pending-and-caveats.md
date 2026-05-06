# 06 — Pending work, caveats, and watch-items

If you're a future Claude session (or a human developer) about to add a feature or fix a bug, **read this before touching anything**. These are the traps.

## Production-readiness review chain (2026-05-06, complete)

Thirteen commits of focused security + reliability hardening, capped by a three-tier reviewer escalation. Chain summary:

- **Tier 1** — security/reliability batch: `390fbb5` `e45e312` `64e7da7` `6f8e67b`. Reviewer pass on these surfaced two follow-ups → `e3f6101`.
- **Tier 2** — second batch: `a04e6f4` `3dd9693` `9fe6f54` `1244a7d` `4bc4b0d` `e2607ca` `fc96b80`. Reviewer pass surfaced 2 blockers + 4 concerns → `59509fe`.
- **Tier 3** — fresh-eyes pass on `a04e6f4^..59509fe` (the full Tier 2 batch + the Tier 2 follow-up). 0 blockers, 2 concerns, 0 false-positives. Both concerns fixed in a single follow-up commit:
  - `MODE_SENSITIVE_PREFIXES` was missing `filter-preview` and `filter-all-files`. Filter Workbench would show stale data from the wrong DB after a Public↔Private flip until the page remounted. Two strings added at [main.tsx:51](../../src/src/src/renderer/main.tsx#L51).
  - `assertNotExecutable` extracted the extension via `lastIndexOf('.')` on the full path, so a dotted parent dir (e.g. `C:\some.dir\myfile`) produced a "extension" containing a path separator. Currently safe (no false-extension matches the blocklist), but structurally wrong and would break if the blocklist is ever extended with multi-segment extensions like `.tar.gz`. Switched to Node's `path.extname()`, which operates on the basename only ([safePath.ts:92-100](../../src/src/src/main/security/safePath.ts#L92-L100)).

**State after Tier 3:** production-readiness thread is caught up. No outstanding reviewer findings against the 2026-05-06 working set. The pattern (each tier surfaces a few concerns about the previous tier's fixes, finding-count decays each round: many → 2 → 6 → 2) suggests a fourth tier would yield diminishing returns; trigger one only if a future change reopens the surface.

**Reviewer-false-positives ledger** — additions from this round: none. Existing entries (NSIS Components page Abort fall-through, NavLink hash matching, Theme localStorage flash, Sandbox disabled, Migration `'Claude, Anthropic'` rename, ExecEngine optimistic-connected race, Startup hidden-flag dual-probe race) still stand.

## Critical review + fix sweep (2026-04-30, late)

User asked for a comprehensive code review + intensive testing pass + fix any real bugs / weak points / UI-UX gaps surfaced. Three parallel investigations ran (focused diff review, security audit, main-process bug hunt). Together they surfaced ~22 findings; this commit shipped only the high-confidence real bugs and the security hardening that matters for the single-user local threat model. False-positive findings are explicitly NOT changed and documented in the plan file (`.claude/plans/hi-my-colleague-and-streamed-shamir.md`) so they don't get re-litigated.

What landed (commit `3b86f6e` in ShortCut_Studio + `9f38801` in Shortcut_Studio_Backend):

**Security:**
- `safeOpenExternal` URL allowlist (https/http only) — closes the `file:///C:/Windows/System32/calc.exe` RCE path that opens whenever an LLM-generated link is clicked. Wired into `app:open-external` IPC, `setWindowOpenHandler`, and the components installer's external-tool path. Blocked URLs land in AppErrors.
- LLM bridge auth token — 32-byte hex secret generated at server startup, required as `X-SCS-Bridge-Token` header on `/llm/complete`. Without it, any local process could call the bridge anonymously and burn the user's API budget. Token is per-launch (not persisted). SCL_Demo Python client reads `ELECTRON_LLM_BRIDGE_TOKEN` env var and sends as the header.
- `redactSecrets` strips OpenAI `sk-…`, Anthropic `sk-ant-…`, Google `AIza…`, HuggingFace `hf_…`, and generic `Bearer` / `x-api-key` patterns from error message text before it reaches toasts and the AppErrors DB. Applied to all 6 provider HTTP error sites in `modelDiscovery.ts` plus the OpenAI usage fetch and the shared `httpJson` helper.
- Dev SQL handler rejects SELECTs against `LLM_Provider` and `LLM_Usage` (the two secret-bearing tables).

**Worker supervisor robustness:**
- `isShuttingDown` flag prevents the orphaned-process race where a worker crashing 1-5 ms before app quit gets auto-respawned AFTER `stopAllWorkers()`. Previously left stale `root_watchdog.exe` in Task Manager.
- Per-handle `manualRestartInProgress` flag stops `restartWorker()` from racing the exit handler into a duplicate spawn — previously two processes would fight for the worker's port.
- `decayBackoff()` reduces `restartCount` by 1 every hour of clean running, so a worker that crashed 5 times due to transient state is no longer permanently stuck in "given up" until manual UI restart.
- New `lastHealthCheckOk` field separates "we tried recently" from "the worker actually answered" — the Diagnostics card renders an amber "no recent OK ping" badge when the process is alive but `/health` is hung. Previously the row read as "healthy" with a fresh timestamp on a hung worker.
- LLM bridge port collision (port 45123 occupied at startup) is now caught in `main/index.ts` and logged to AppErrors with a likely-cause hint, instead of bubbling as an unhandled promise rejection.

**Renderer hardening:**
- `recordRendererError` IPC caps `message` at 4 KB, `stack` at 16 KB, `context` at 16 KB serialised (with cyclic-ref fallback) at the IPC boundary. Defense-in-depth so a buggy/malicious renderer can't burn main-process CPU coercing multi-MB strings.

**UI/UX:**
- Dashboard first-run empty state: when no folders are configured AND no scan has run, replace the bottle cards (which would all be zero) with a welcome card pointing at Folders. Refresh re-evaluates once a folder is added.

Boot smoke test passed: bridge bound on `127.0.0.1:45123`, no port collisions, no auth errors from workers. Installer rebuilt cleanly (227 MB at `release-builds/ShortCut Studio-Setup-0.4.0.exe`).

Reviewer findings explicitly NOT changed (see plan file for full reasoning):
- "NSIS Components page Abort falls through" — wrong; NSIS `Abort` in a `pageLeave` callback correctly cancels the page transition.
- "NavLink isActive doesn't match with hash" — wrong; React Router v6 strips the hash before matching.
- "Theme localStorage flash" — real but minor, deferred to UI Phase 3.
- "Sandbox disabled is critical" — documented architectural choice; preload uses contextBridge which sandbox would block.
- "Migration `'Claude, Anthropic'` rename edge case" — vanishingly unlikely.
- "ExecEngine optimistic-connected race" — no observable bug today; revisit when Queue-TCP transport ships.
- "Startup hidden-flag dual-probe race" — `setLoginItemSettings` overwrites; no two-entry race in practice.

## v0.4.1 ship summary (2026-04-30)

Wizard installer redesign + auto-start + theme persistence. Same `0.4.0` version string in `package.json` for now; the changes are additive UX/persistence work without app-behaviour deltas warranting a minor bump.

What landed:

- **Multi-page NSIS wizard** replacing v0.4.0's single end-of-install MessageBox. Welcome page lists the bundled stack (app, workers, IPFS, Nginx, seed DBs); a new mid-flow Components page lets the user opt out of IPFS / Nginx (post-copy `RMDir /r`); the Finish page detects Ollama and LM Studio installs (`IfFileExists` against `%LOCALAPPDATA%\Programs\…\*.exe`) and shows inline status + a single MUI link to whichever is missing first. The whole `installer.nsh` file is wrapped in `!ifndef BUILD_UNINSTALLER` to suppress NSIS warning 6010 during the uninstaller compile (electron-builder treats those as build errors).
- **Opt-out warning** — if either bundled component is unchecked, an `MB_YESNO|MB_ICONQUESTION` confirmation surfaces explaining the implications (v2 features won't work without re-add) before allowing Next. `/SD IDYES` keeps silent installs unblocked.
- **`/COMPONENTS=` CLI flag** — `Setup.exe /S /COMPONENTS=IPFS,NGINX /D=C:\Apps\SCS`. Exhaustive whitelist when present; defaults to all-on when absent (back-compat with v0.4.0 silent scripts). Parser uses `${StrLoc}` from `StrFunc.nsh` (registered with the no-args declaration call at file scope, gated on the installer pass).
- **Shared `OptionalComponent` manifest** at [src/shared/components-manifest.ts](../../src/src/src/shared/components-manifest.ts). Single source of truth for IPFS / Nginx / Ollama / LM Studio. Read by the NSIS surface (hardcoded for now), the new `[components:list]` IPC handler, and the new Settings → Components panel. Bundled entries carry `vendorFetchKey` matching `scripts/fetch-vendor-binaries.mjs`; external entries carry `externalUrl` + `detectPort`.
- **Settings → Components panel** at [renderer/features/settings/ComponentsCard.tsx](../../src/src/src/renderer/features/settings/ComponentsCard.tsx). Auto-refreshes every 15s. Bundled rows show "Bundled — installed" or "Removed at install" with an `[Install]` button that re-downloads + extracts via the runtime port of the vendor fetcher (`main/components/installer.ts`). External rows show "Detected on :PORT" or "Not detected" with a `[Get it ↗]` button. Bundled install in dev mode throws — would otherwise pollute Electron's own `resources/`.
- **Settings → Startup card** at [renderer/features/settings/StartupCard.tsx](../../src/src/src/renderer/features/settings/StartupCard.tsx). Two checkboxes: "Launch at Windows startup" toggles `HKCU\…\Run` via Electron's `app.setLoginItemSettings`; "Start minimized to the system tray" appends `--hidden` to the registered launch args. [window.ts](../../src/src/src/main/window.ts) checks `process.argv.includes('--hidden')` and skips the initial `win.show()`. State is read live from the registry on every Settings mount (no cache), so external changes via Task Manager are picked up.
- **Theme toggle now persists** — [Header.tsx::useTheme](../../src/src/src/renderer/components/layout/Header.tsx) reads/writes localStorage key `scs.theme`. The v0.4.0 hook initialised `useState(false)` on every mount and ran `classList.remove('dark')` on first render, so every restart reverted to light regardless of the user's choice.
- **Code-reviewer-flagged fixes** — `IfFileExists +N` relative jumps replaced with named labels (real off-by-one bug in early drafts); PowerShell single-quote escape (`psQuote` + `-LiteralPath`) for usernames containing `'`; bundled-component install gated on `app.isPackaged`.

Build artifact: `release-builds/ShortCut Studio-Setup-0.4.0.exe` (still 227 MB — only behavioural changes, no new bundled bytes).

## v0.4.0 ship summary (2026-04-29)

The current installer at `src/src/release-builds/ShortCut Studio-Setup-0.4.0.exe` (~237 MB) ships:
- **HuggingFace + LM Studio** as new LLM providers (full adapter chain: completion, classifier, discovery, onboarding UI).
- **OpenAI inline spend display** — fetches today's USD from `/v1/usage`, hides gracefully on any failure. Other cloud providers get an "Open usage dashboard" button that opens their billing page in the browser via `app.openExternal`.
- **LLM bridge for Python workers** — `gemini_processor` no longer hardcodes Gemini. The user's GUI provider choice flows through to scan-time topic naming via the loopback HTTP bridge on port 45123. Workers carry no API keys.
- **All three SCL_Demo workers building + running cleanly** (PyInstaller + frozen-detect data-root resolver). Bundled into the installer with explicit allowlist (no `vapp.exe` leak).
- **Vendored IPFS Kubo v0.41.0 + Nginx 1.26.2** in `resources/extras/`. Currently dormant — IPFS allocation feature and ExecEngine HTTP layer light them up in v2.
- **Custom NSIS hook** — post-install MessageBox offers to open Ollama / LM Studio download pages.
- **Per-user data root** — supervisor sets `SCL_DEMO_DATA_ROOT=<userData>/scl_data` for spawned workers; bundled `scl_data_seed/db_files/` copied across on first launch; v0.3.x users get a one-time migration from `<userData>/scl_db_files/`.
- **Side fix:** the `'Claude, Anthropic'` Provider_Name typo from earlier seed variants is canonicalised to `'Claude'` via a one-line idempotent UPDATE in the migration. Unblocks completion routing + budget seeding (the latter only mattered briefly while `LLM_Budgets` existed; the table is now dropped).

Verified end-to-end at the dev-mode level (bridge on 45123 + workers on 19001/19002/19003 all serve `/health` cleanly under the supervisor). Full installer-mode runtime verification on this machine was blocked by Windows Defender / SmartScreen on the unsigned `.exe` from a non-default install path — a real-world UX consideration that costs ~$300-$1200/yr to remove via code-signing certificate.

## High-priority caveats (read first)

### 1. Worker .exe rebuilds — DONE (2026-04-29)

**Status: All three workers (`root_watchdog`, `topic_watchdog`, `gemini_processor`) build, start, and serve `/health` + `/status` correctly. Verified end-to-end with the ShortCut Studio supervisor's port + env-var contract.**

The earlier blocker had two layers — only the first was documented:

1. **Build-time:** PyInstaller couldn't see venv deps. Fixed earlier in 2026-04-28 by switching build scripts to `python -m PyInstaller`, adding `__init__.py` to `tools/scan/topics/`, and installing `pyinstaller`, `fastapi`, `uvicorn[standard]` in `.venv`.
2. **Runtime:** even after a successful build, the bundled `.exe` died on startup. Under PyInstaller `--onefile`, `__file__` lives in a `_MEIxxxxxx` temp dir on the system temp drive, so any code that resolved `db_files/`, `config.json`, `Support_priv_list.json`, etc. via `os.path.dirname(__file__)` looked in the wrong place. Symptoms: `sqlite3.OperationalError: unable to open database file`, `ValueError: path is on mount 'C:', start on mount 'D:'` (cross-mount `os.path.relpath` crash), `FileNotFoundError` from the watchdog observer. The FastAPI thread started briefly then died with the parent process when watchdog init failed.

**The fix (landed in SCL_Demo 2026-04-29):**
- New `tools/utils_paths.py` with a single canonical resolver `get_data_root()` that tries (1) `SCL_DEMO_DATA_ROOT` env var, (2) walk up from `os.path.dirname(sys.executable)` looking for a `db_files/` ancestor when `sys.frozen` is set, (3) `<this file>/../..` as the dev fallback. Result is cached.
- `tools/globalVariables.py`, `scan/config_scan.py`, `vapp/config_vapp.py`, `topics/config_topic.py`, `vapp/json_file.py` all routed through the resolver. Walked-up `__file__` patterns and the `os.getcwd().split(__projName__)` cwd-trick are gone.
- `tools/utils_error.py::getContext` now wraps `os.path.relpath` in `try/except ValueError` so cross-mount cases stop spamming tracebacks.
- New `is_supervised()` and `keep_alive_until_signal()` helpers in `tools/worker_api.py`. The three watchdog `main()`s now call `keep_alive_until_signal()` if their primary job fails to start under supervision — the FastAPI `/health` thread stays up so the supervisor sees a healthy-but-idle worker instead of a vanished one.
- Unrelated bug fix: `tenacity.wait_exponential(factor=...)` → `exp_base=...` rename in `topics/process_data_Gemini.py` (kwarg renamed in tenacity 6.0; pre-6.0 versions use `@asyncio.coroutine` which Python 3.11+ removed, so neither version ran without this).
- `requirements.txt` re-encoded UTF-8 and refreshed via `pip freeze`.

**Smoke test verified (2026-04-29 from this repo against `D:/Client-Side_Project/SCL_Demo/_exe/`):**
```
WORKER_HEALTH_PORT=19001 ./_exe/root_watchdog.exe   # /health → {"ok":true,"uptime_seconds":16.8}
WORKER_HEALTH_PORT=19002 ./_exe/topic_watchdog.exe   # /health → ok
WORKER_HEALTH_PORT=19003 ./_exe/gemini_processor.exe # /health → ok
```

**Caveat carried forward from the fix:** `topics/config_topic.py:127` still hardcodes the topic folder as `<user-home>/Desktop/_SCL_` (driven by `db_files/config.json::paths.topic_folder`). On a machine where that folder doesn't exist, `topic_watchdog` logs warnings but stays alive thanks to `keep_alive_until_signal()` — the supervisor sees a healthy worker that hasn't done any work. That matches the intended behavior, but is the seam to address whenever per-user folder configuration becomes a UI concern.

**Cleanup pending:** `_exe/*.exe.bak` (pre-fix safety copies) still in place. Delete once you've personally validated new builds end-to-end with the running app.

### 2. Workers + seed DBs are now bundled into the installer (DONE 2026-04-28)

`electron-builder.yml::extraResources` now ships:
- `exe/` (LocalHostTools binaries) → `resources/exe/`
- `SCL_Demo/_exe/{root_watchdog,topic_watchdog,gemini_processor}.exe` → `resources/workers/`
- `SCL_Demo/db_files/SCLFolder_{Publ,Priv}.db` → `resources/scl_db_seed/`

`config.ts::resolveWorkersDir` already picks up `<resourcesPath>/workers/` as its first choice in packaged builds. `db/scl-folder.ts::sclDbDir` copies seed DBs from `resources/scl_db_seed/` to `userData/scl_db_files/` on first launch.

**Caveat (resolved 2026-04-29):** the bundled workers are now the working post-2026-04-29 `.exe`s. Item #1 above is done. New builds drop in via the existing `extraResources` block — no further config change needed. Run `npm run build:win` from `src/src/` and the working workers ride along.

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

### `LLM_Usage` IS now written (UPDATED 2026-04-29)

`src/main/llm/completion/index.ts::logUsage()` writes a row after every successful completion call: `(providerId, modelId, feature, tokensIn, tokensOut, latencyMs, ts)`. The OpenAI-specific inline spend display on the LLMs page reads from the provider's own `/v1/usage` endpoint instead (provider-side truth beats local tally for billing); `LLM_Usage` is now used by analytics consumers downstream.

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
