---
name: package-win
description: Build the Windows NSIS installer via electron-builder (output → src/src/release-builds/). Use when the user asks to "package", "build a release", "make an exe", or "make an installer".
---

# package-win

Wraps `npm run build:win`, which is `electron-vite build && electron-builder --win`. Produces an NSIS installer plus an unpacked directory at `release-builds/win-unpacked/` for local smoke testing.

## Pre-flight

- Confirm with the user before running — this overwrites `src/src/release-builds/`. Don't auto-run.
- Ensure `node_modules` is installed in `src/src/`. `electron-builder install-app-deps` runs automatically via the `postinstall` script and rebuilds `better-sqlite3` for the packaged Electron version.
- Confirm `src/src/resources/icon.ico` exists and has a **256×256** variant — electron-builder rejects smaller ones. If unsure, check:
  ```bash
  python -c "from PIL import Image; img=Image.open(r'D:/Client-Side_Project/ElectronAdmin2/src/src/resources/icon.ico'); print([e.dim for e in img.ico.entry])"
  ```

## Run

```bash
cd "d:/Client-Side_Project/ElectronAdmin2/src/src" && npm run build:win
```

Use `run_in_background: true` — the first run downloads Electron prebuilts (~115 MB) and takes 2–5 minutes.

## Output

- **Installer**: `src/src/release-builds/ShortCut Studio-Setup-<version>.exe` (NSIS, ~115 MB)
- **Unpacked app**: `src/src/release-builds/win-unpacked/ShortCut Studio.exe` — smoke-test without installing
- **Update metadata**: `src/src/release-builds/latest.yml` — consumed by electron-updater once the auto-update feed is activated (v1.5)

## Verifying

- Launch `release-builds/win-unpacked/ShortCut Studio.exe` to confirm the bundled app starts.
- Check the installer filename matches the `version` in `src/src/package.json`.
- Confirm `release-builds/win-unpacked/resources/exe/` contains `SCL_ListPorts.exe` and siblings (bundled via `extraResources` in `electron-builder.yml`).

## Don't

- Don't publish / upload / sign — out of scope for this skill. Code signing needs an EV or OV cert the owner has to purchase; without it, Windows SmartScreen warns users. That's expected in v1.
- Don't set `asar: false` — `better-sqlite3`'s `.node` binary is already properly `asarUnpack`ed in `electron-builder.yml`. Leave it.
