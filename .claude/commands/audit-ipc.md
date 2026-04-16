---
description: Cross-reference all Electron IPC channels across main / preload / renderer and surface mismatches.
---

Delegate to the `ipc-auditor` subagent. Ask it to:

1. Walk every `ipcMain.on(...)` and `event.sender.send(...)` in `src/src/index.js`.
2. Walk every `ipcRenderer.send(...)` and `ipcRenderer.on(...)` in `src/src/renderer.js`.
3. Confirm `src/src/preload.js` does not narrow or rename any channels (it currently passes everything through).
4. Build a table: channel | sender file:line | handler file:line | listener file:line | status (OK / MISSING_HANDLER / MISSING_LISTENER / ARG_MISMATCH / TYPO).
5. Report any channel that is sent but never handled, handled but never sent, or where the renderer's argument count disagrees with the main handler's.

Don't propose fixes — just surface the gaps.
