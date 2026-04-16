---
name: rebuild-native
description: Rebuild the native sqlite3 binding for the project's bundled Electron version. Use when the app fails on launch with "was compiled against a different Node.js version" or after a node/electron upgrade.
---

# rebuild-native

`sqlite3` is a native (C++) Node module. Electron embeds its own Node ABI, so the binding compiled for system Node.js will not load inside Electron. This skill rebuilds it.

## When to invoke
- App throws `Error: The module '...node_sqlite3.node' was compiled against a different Node.js version` on startup
- Just upgraded Electron in `src/src/package.json`
- Just ran `npm install` after deleting `node_modules`

## How to run

```bash
cd "d:/Client-Side Project/ElectronAdmin2/src/src" && npx electron-rebuild
```

This reads `package.json`'s `electron` devDep, downloads matching headers, and rebuilds every native module against that ABI. Takes 30–90 seconds.

## Verify

```bash
ls "d:/Client-Side Project/ElectronAdmin2/src/src/node_modules/sqlite3/build/Release/node_sqlite3.node"
```

The file should exist and have a recent mtime.

## Caveats
- Requires a working Windows C++ toolchain (Visual Studio Build Tools / `windows-build-tools`). If the user lacks that, `electron-rebuild` will fail with `MSBuild` errors — direct them to install Build Tools rather than trying workarounds.
- Don't run from project root; it must run from `src/src/` where `package.json` lives.
- This is not destructive but it WILL rewrite `node_sqlite3.node`. Confirm before re-running if the user reported things were working a moment ago.
