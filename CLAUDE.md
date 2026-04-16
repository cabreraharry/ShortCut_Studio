# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## Project Overview

**SCL_Admin** — a Windows-only Electron desktop app that acts as the admin/control panel for a larger SCL document-processing system. It manages:

- **Indexed folders** — directories the SCL pipeline scans (with include/exclude semantics)
- **LLM providers and models** — Ollama (local), OpenAI, Claude (Anthropic), Gemini
- **OCR processing progress** — view of in-flight OCR jobs
- **Admin settings** — localhost port, topic threshold, CPU performance threshold
- **Bundled Windows .exe utilities** — `SCL_ListPorts.exe`, `SCL_Restart_PortIDs.exe`, `SCL_Startup_PortIDs.exe` running background services on ports 18866 / 18877 / 18899

The app sits in the system tray, persists state in a local SQLite database, and shells out to bundled Win32 binaries.

## Repository Layout

The repo has a confusing nested structure — read this carefully before navigating.

```
ElectronAdmin2/
├── src/
│   └── src/                     <-- ACTIVE codebase (work here)
│       ├── index.js             Electron main process (~500 lines, all IPC handlers)
│       ├── preload.js           contextBridge — exposes ipcRenderer + openExternal
│       ├── renderer.js          UI logic, jQuery, table rendering (~730 lines)
│       ├── index.html           Single-page UI (4 tabs: Folders / LLMs / Progress / Set Details)
│       ├── custom.css           App styling
│       ├── start.js / stop.js   Spawn/kill the bundled .exe services
│       ├── main.js              Alternative launcher (rarely used)
│       ├── package.json         npm scripts + dependencies
│       ├── db_files/
│       │   ├── loc_adm.db       Primary SQLite DB
│       │   └── folders.db       Legacy / unused
│       ├── exe/                 SCL_*.exe Win32 binaries + data_log.log
│       ├── asset/               Icons + Bootstrap/FontAwesome CSS
│       ├── node_modules/        Installed (~331 pkgs)
│       └── release-builds/      electron-packager output
├── src_orig/src/                Older snapshot — DO NOT EDIT
├── n/                           Stripped-down sketch — ignore
├── _Docu/                       PDF docs + design screenshots
├── db_files/                    Standalone DB copies (loc_adm.db, etc.)
├── asset/                       Asset duplicates
└── README.md                    Top-level install/run instructions
```

**Treat `src/src/` as the project root for all real work.** The outer `src/` and `src_orig/` are historical.

## Run / Build / Package

All commands run from `src/src/`:

```sh
npm install            # only if node_modules missing or after dep changes
npm start              # node start.js && electron .
npm run package-win    # electron-packager → release-builds/SCL_Admin-win32-x64
```

`npm start` first runs `start.js`, which `exec`s `exe\SCL_Restart_PortIDs.exe -c` to bring up the background port services, then launches Electron.

If the native `sqlite3` module fails on app launch (`Error: The module ... was compiled against a different Node.js version`), rebuild it for Electron:

```sh
npx electron-rebuild
```

There is **no virtualenv / Python involved**. This is pure Node.js + Electron. Don't create a `.venv`.

## Architecture

### Process model
- **Main** (`index.js`) — owns the SQLite connection, all IPC handlers, the tray icon, and `dialog.showOpenDialog`.
- **Preload** (`preload.js`) — context-isolated bridge exposing a thin `window.electron.ipcRenderer` (just `on` / `send`) plus `openExternal`.
- **Renderer** (`renderer.js`) — jQuery + vanilla DOM. Sends IPC, receives data, renders tables.

Security posture: `contextIsolation: true`, `nodeIntegration: false`, CSP set in `index.html`. Keep it that way.

### IPC channels (renderer → main → renderer)

Folders tab:
- `FF_fetch:data` → `FF_data:fetched`
- `add-folders` → `folders:added` (then renderer auto-fires `remove:childrenincluded`)
- `update:path` → `path:updated`
- `remove:folder` → `folder:removed`
- `remove:childrenincluded` → `children:cleaned`

LLM tab:
- `LLM_fetch:data` → `LLM_data:fetched`
- `LLM_fetch:Models` (also flips IsDefault) → `LLM_Model_Data:fetched`
- `LLM_insert:Model` → `LLM_Model_Data:insert`
- `LLM_Provider:update` (API key)
- `LLM_Model_Update_Default`
- `LLM_Model_Update_Name`

Progress tab:
- `PG_fetch:data` → `PG_data:fetched`

Admin / Set Details:
- `Admin_data:fetch` → `Admin_data:fetched`
- `Admin_data:update` → `Admin_data:updated`

Misc:
- `quit:app`, `open-external`, `select-directories` (broadcast on did-finish-load)

### SQLite schema (`db_files/loc_adm.db`)

```sql
AdminData(RecID PK, Localhost_Port=44999, NumTopicThreshold=10, CPU_Perf_Threshold=50)
Folder(ID PK, Path, Include 'Y'|'N', ProcRound, LastUpd_CT)
LLM_Provider(Provider_ID PK, Provider_Name, Has_API_Key, API_Key, API_Host,
             IsDefault 'Y'|'N', Supported 'Y'|'N', AllowAddModel 'Y'|'N')
Models(ModelID PK, ProviderID FK, ModelName, ProviderDefault 'Y'|'N')
```

Conventions: boolean-ish fields are `VARCHAR(1)` holding `'Y'` / `'N'`. `IsDefault` / `ProviderDefault` are toggled with `CASE WHEN ... THEN 'Y' ELSE 'N' END` so exactly one row wins.

Pre-seeded LLM providers: **Ollama** (default, `http://127.0.0.1:11434`, allows custom models), **OpenAI**, **Claude/Anthropic**, **Gemini**.

### Folder include/exclude semantics
- `Include='Y'` → green row, this directory IS indexed
- `Include='N'` → orange row with minus icon, this directory is EXCLUDED
- When adding a folder whose parent is already in the table, it's inserted as `Include='N'` (an exclusion). When adding a top-level folder, it's `Include='Y'`.
- After adding, `remove:childrenincluded` deletes any existing `Include='Y'` descendants under the new path so exclusions take precedence.

## Known Bugs / Gotchas

When touching these areas, fix the bug rather than working around it:

1. **`OCR_Process` table doesn't exist** in `loc_adm.db` (only `AdminData`, `Folder`, `LLM_Provider`, `Models`). Code at `src/src/index.js:185` queries `SELECT * FROM OCR_Process`, so the **Progress** tab silently returns `[]` (or errors). Either create the table or stub the handler.
2. **`getLastID` case bug** at `src/src/index.js:322` — checks `row.lastID` (lowercase) but resolves `row.LastID + 1`. The lowercase check always fails, falling through to the `LastID + 1` branch. Mostly works but the lastID local variable bookkeeping is off.
3. **`childRow.id` lowercase** at `src/src/index.js:409` — column is `ID`, so `DELETE FROM Folder WHERE ID = undefined` runs. Children-included cleanup is broken.
4. **`tray.destroy()` in `quit:app`** assumes `tray` is set; on the `before-quit` path with no window, `mainWindow` may be null when `removeAllListeners` runs (`index.js:484`).
5. **Path escaping** — folder paths are stored with `\\\\` (double-escaped backslashes). Sorting uses `SUBSTRING(Path,1,1)` for drive letter ordering. Don't normalize paths without checking what reads them downstream.
6. **API_Key field is `VARCHAR(50)`** — real API keys are longer (OpenAI ~ 50+, Anthropic ~ 100+). Will silently truncate.
7. **CSP allows `unsafe-inline` for styles** but inline `<script>` would be blocked. Keep all JS in external files.

## Coding Conventions

- **Vanilla JS + jQuery + Bootstrap 4.** No build step, no transpilation, no framework.
- Renderer accesses IPC via `window.electron.ipcRenderer` (NOT `require('electron')` — context isolation).
- DB access happens **only in main**; never expose `sqlite3` to the renderer.
- Status flags are `'Y'`/`'N'` strings, not booleans.
- File paths use Windows backslashes; preserve that.
- The Bootstrap utility class `d-none` is used everywhere for show/hide. Match that pattern.
- Logging is `console.log` to the Electron stdout (captured to `error.log` in some launch configs).

## Working with This Repo

- **Always edit in `src/src/`**, never `src_orig/` or the top-level `src/` shell.
- After changing native deps (sqlite3), re-run `npx electron-rebuild` from `src/src/`.
- Don't commit `*.db` (already in `.gitignore`) — but DO commit schema-affecting code.
- If you need to inspect or modify the SQLite DB, use the helper agent (`db-inspector`) or `node -e` with the already-installed `sqlite3` module.
- Windows-only assumptions are baked in (`taskkill`, `start <url>`, `.exe` shellouts). Don't try to make this cross-platform without explicit ask.

## Useful Reference Files

- [src/src/index.js](src/src/index.js) — main process, all IPC handlers
- [src/src/renderer.js](src/src/renderer.js) — UI logic
- [src/src/preload.js](src/src/preload.js) — security bridge
- [src/src/index.html](src/src/index.html) — UI structure + CSP
- [src/src/package.json](src/src/package.json) — scripts + deps
- [_Docu/](_Docu/) — design PDFs and screenshots
