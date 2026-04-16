# Project Rules

Hard rules that apply to every change in this repo. These are NOT suggestions.

## 1. Edit only inside `src/src/`
The active code lives in `src/src/`. The folders `src_orig/`, `n/`, top-level `src/` (parent shell), and `_Docu/` are historical or reference material. **Never edit them.** If a change seems to require touching them, stop and ask.

## 2. Don't break the security posture
- `contextIsolation: true` and `nodeIntegration: false` in `BrowserWindow` — leave them.
- The CSP in `src/src/index.html` is `default-src 'self'`. Don't add CDN links, inline `<script>`, or `'unsafe-eval'`.
- The renderer accesses Electron only through the `window.electron` bridge in `preload.js`. Never re-introduce `require('electron')` in the renderer or expose `fs`, `child_process`, or the `sqlite3` handle to it.

## 3. SQLite access stays in main
All `sqlite3` calls happen in `src/src/index.js`. The renderer asks for data via IPC. Never expose the `db` handle to the renderer.

## 4. Don't commit databases
`*.db` is gitignored. Don't force-add a DB file. If you need to ship a seeded DB, write a `seed.js` script instead.

## 5. Windows-only is the contract
This app shells out to `taskkill`, `start <url>`, and bundled `.exe` binaries in `src/src/exe/`. Don't refactor for cross-platform without an explicit ask — it will silently break the install base.

## 6. Boolean-ish columns are `'Y'` / `'N'` strings
Every `IsDefault`, `ProviderDefault`, `Include`, `Has_API_Key`, `Supported`, `AllowAddModel` is `VARCHAR(1)` storing `'Y'` or `'N'`. Don't introduce real booleans, ints, or `'true'`/`'false'`. Toggling "exactly one default" uses `CASE WHEN id=? THEN 'Y' ELSE 'N' END`.

## 7. Match the IPC channel naming
New channels use `Topic:verb`, e.g. `LLM_fetch:Models`, `Folder:remove`. Don't introduce camelCase or kebab-case channels.

## 8. Don't mock the database in any future tests
If tests are added later, they must hit a real SQLite file (a temp DB, not `loc_adm.db`). Mocking sqlite3 has caught nothing in past projects and hides schema drift.

## 9. Native deps need `electron-rebuild`
After `npm install`, after upgrading Electron, or after `node` upgrades — run `npx electron-rebuild` from `src/src/`. Don't try to "fix" a `node_sqlite3.node` ABI mismatch any other way (no copying prebuilts, no editing binding paths).

## 10. Don't add a build step
No webpack, no vite, no TypeScript compiler, no Babel. The renderer is plain JS + jQuery loaded directly from `<script src=...>`. If you think a build step is justified, raise it with the user first.

## 11. Confirm before destructive ops
- Don't run `npm run package-win` without confirming — it overwrites `release-builds/`.
- Don't run any DML against `loc_adm.db` (INSERT/UPDATE/DELETE/DROP/ALTER) without explicit per-query confirmation.
- Don't `taskkill` running services without saying so first.
