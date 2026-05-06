import { access } from 'node:fs/promises'
import { getLocAdmDb } from '../db/connection'
import { notify } from '../notifications/dispatch'

/**
 * Polls included Folder rows every POLL_MS to detect when a tracked path
 * stops being reachable (USB unplugged, network drive offline, folder
 * renamed by another process). Fires a one-shot 'drive' notification per
 * disappearance / restoration so the user knows scan coverage changed.
 *
 * Debouncing rule:
 *   - First time we see `path` missing → fire 'unavailable' notification +
 *     add to known-missing set.
 *   - Subsequent polls while missing → no notification (path stays in set).
 *   - Path comes back accessible AND was in the set → fire 'restored'
 *     notification + remove from set.
 *
 * In-memory state only — restarting the app re-fires once for any
 * still-missing path. That's intentional: the user benefits from being
 * reminded "this folder is still gone" once per session.
 */

const POLL_MS = 30_000

let intervalHandle: NodeJS.Timeout | null = null
const knownMissing = new Set<string>()

interface FolderRow {
  Path: string
  Include: string
}

async function pollOnce(): Promise<void> {
  let rows: FolderRow[]
  try {
    const db = getLocAdmDb()
    rows = db
      .prepare("SELECT Path, Include FROM Folder WHERE Include = 'Y'")
      .all() as FolderRow[]
  } catch {
    // DB hiccup; try again next tick.
    return
  }

  const currentPaths = new Set<string>()
  for (const row of rows) {
    if (typeof row.Path !== 'string' || row.Path.length === 0) continue
    currentPaths.add(row.Path)
    let exists = false
    try {
      await access(row.Path)
      exists = true
    } catch {
      exists = false
    }

    if (!exists && !knownMissing.has(row.Path)) {
      knownMissing.add(row.Path)
      // 'warning' rather than 'error': a folder going temporarily
      // unreachable (USB unplugged, network drive offline, share
      // disconnected) is normal day-to-day behaviour, not a system
      // failure. The amber icon communicates "heads up" without the
      // alarm bells of a red error icon.
      notify({
        severity: 'warning',
        source: 'drive',
        title: 'Folder unavailable',
        body: `${row.Path} can no longer be reached. Scan coverage will be reduced until it returns.`,
        action: { kind: 'navigate', target: '/folders' }
      })
    } else if (exists && knownMissing.has(row.Path)) {
      knownMissing.delete(row.Path)
      notify({
        severity: 'info',
        source: 'drive',
        title: 'Folder restored',
        body: `${row.Path} is reachable again.`,
        action: { kind: 'navigate', target: '/folders' }
      })
    }
  }

  // Drop any entries for paths the user removed from the Folder table — we
  // shouldn't fire 'restored' for a folder that's no longer being tracked.
  for (const cached of knownMissing) {
    if (!currentPaths.has(cached)) knownMissing.delete(cached)
  }
}

export function startDriveWatcher(): void {
  if (intervalHandle) return
  // Fire once on next tick so the first OS toast doesn't slip through during
  // boot before the BrowserWindow is ready.
  setTimeout(() => {
    void pollOnce()
    intervalHandle = setInterval(() => {
      void pollOnce()
    }, POLL_MS)
  }, 5_000)
}

export function stopDriveWatcher(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle)
    intervalHandle = null
  }
  knownMissing.clear()
}
