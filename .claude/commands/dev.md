---
description: Start the ShortCut Studio Electron app in dev mode and tail logs.
---

Run the Electron app from `src/src/`:

1. Kill any stale electron process (silent if none): `taskkill /F /IM electron.exe`
2. From `d:/Client-Side_Project/ElectronAdmin2/src/src/`, run `npm run dev` in the background. **IMPORTANT:** `unset ELECTRON_RUN_AS_NODE` first — Claude Code's bash sets it by default and Electron will crash on `app.on()` if it stays set.
3. Watch stdout for `[main] bootstrap` lines, the `electron-vite dev server running` message, and any uncaught exceptions in the main process.
4. Report back: app started / DB initialised / any visible errors. Note explicitly that UI clicks were not exercised.

If `better-sqlite3` errors with "compiled against a different Node.js version", run `npx electron-rebuild` from `src/src/` and retry.
