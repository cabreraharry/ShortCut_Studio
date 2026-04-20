---
description: Start the SCL_Admin Electron app in dev mode and tail logs.
---

Run the Electron app from `src/src/`:

1. Kill any stale electron / SCL service processes (silent if none): `taskkill /F /IM electron.exe; taskkill /F /IM SCL_Restart_PortIDs.exe`
2. From `d:/Client-Side_Project/ElectronAdmin2/src/src/`, run `npm start` in the background.
3. Watch stdout for `Connected to the SQLite database`, `index.html File loaded successfully`, and any `Error` lines.
4. Report back: app started / DB connected / any visible errors. Note explicitly that UI clicks were not exercised.

If sqlite3 errors with "compiled against a different Node.js version", run `npx electron-rebuild` from `src/src/` and retry.
