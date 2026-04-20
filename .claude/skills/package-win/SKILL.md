---
name: package-win
description: Build the Windows distributable via electron-packager (output → src/src/release-builds/SCL_Admin-win32-x64). Use when the user asks to "package", "build a release", or "make an exe".
---

# package-win

Wraps `npm run package-win`, which is `electron-packager . SCL_Admin --platform=win32 --arch=x64 --out=release-builds --overwrite --icon=icon.ico`.

## Pre-flight
- Confirm with the user: this overwrites `src/src/release-builds/SCL_Admin-win32-x64/`. Don't auto-run.
- Ensure `node_modules` is built and `node_sqlite3.node` exists for the right Electron ABI (see `rebuild-native`).
- Confirm `src/src/icon.ico` is present.

## Run

```bash
cd "d:/Client-Side_Project/ElectronAdmin2/src/src" && npm run package-win
```

Run with `run_in_background: true` if the user wants logs. First-time runs download Electron prebuilts (~80MB) and take several minutes.

## After
- Output: `src/src/release-builds/SCL_Admin-win32-x64/SCL_Admin.exe`
- The `db_files/`, `exe/`, `asset/` folders are bundled inside `resources/app/`.
- Verify by listing `release-builds/SCL_Admin-win32-x64/` — `SCL_Admin.exe` should be present and non-zero size.

## Don't
- Don't try to publish, sign, or upload the build — out of scope.
- Don't add `--asar` without asking; the bundled `.exe` files in `exe/` get awkward inside an asar archive.
