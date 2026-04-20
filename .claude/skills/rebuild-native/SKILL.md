---
name: rebuild-native
description: Rebuild the native better-sqlite3 binding for the project's bundled Electron version. Use when the app fails on launch with "was compiled against a different Node.js version" or after a node/electron upgrade.
---

# rebuild-native

`better-sqlite3` is a native (C++) Node module. Electron embeds its own Node ABI, so the binding compiled for system Node.js will not load inside Electron. This skill rebuilds it.

## When to invoke

- App throws `Error: The module '...better_sqlite3.node' was compiled against a different Node.js version` on startup
- Just upgraded `electron` in `src/src/package.json`
- Just ran `npm install` after deleting `node_modules` (normally `postinstall` handles it — check first)

## How to run

```bash
cd "d:/Client-Side_Project/ElectronAdmin2/src/src" && npx electron-rebuild -f -w better-sqlite3
```

`-f` forces rebuild even if the binding exists; `-w better-sqlite3` scopes to that single module (faster than rebuilding every native dep).

Alternative (equivalent, slightly slower — rebuilds all native deps):

```bash
cd "d:/Client-Side_Project/ElectronAdmin2/src/src" && npx electron-builder install-app-deps
```

Takes 30–90 seconds.

## Verify

```bash
ls "d:/Client-Side_Project/ElectronAdmin2/src/src/node_modules/better-sqlite3/build/Release/better_sqlite3.node"
```

The file should exist with a recent mtime. Launch the app (`npm run dev`) and confirm no native-module error appears in the terminal.

## Caveats

- Requires a working Windows C++ toolchain (Visual Studio Build Tools). If the user lacks it, `electron-rebuild` fails with MSBuild errors — direct them to install Build Tools rather than working around it.
- Run from `src/src/`, not the project root.
- Not destructive, but it does rewrite `better_sqlite3.node`. Confirm before re-running if the user said things were working a moment ago.
