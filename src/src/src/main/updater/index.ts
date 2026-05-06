import { app, BrowserWindow } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import type { UpdaterStatus, UpdaterState } from '@shared/types'
import type { WebStubManifest } from '@shared/web-stub-manifest'
import { recordError } from '../diagnostics/errorStore'
import { fetchManifest, compareSemver } from './manifest'
import { downloadStub, launchAndQuit } from './applyUpdate'

// In-app updater. Periodically fetches the manifest, compares versions, and
// (on user confirmation) downloads + launches the new stub installer to
// reinstall over the existing install. Disabled in dev.
//
// Fetched manifest only — the running app never reaches into the .7z payload
// or the IPFS/Nginx component download URLs directly. Those run when the
// stub re-launches.

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000  // 6 hours
const INITIAL_CHECK_DELAY_MS = 30 * 1000      // 30s after main window ready
// Throttle progress broadcasts so a fast network doesn't fire IPC events at
// 60+ Hz (the renderer card only renders a percentage; sub-100ms updates are
// imperceptible and just burn the IPC channel).
const PROGRESS_BROADCAST_INTERVAL_MS = 200

interface InternalState {
  state: UpdaterState
  manifest: WebStubManifest | null
  lastCheckedAt: string | null
  lastError: string | null
  downloadedBytes: number | null
  downloadTotalBytes: number | null
}

const internal: InternalState = {
  state: 'idle',
  manifest: null,
  lastCheckedAt: null,
  lastError: null,
  downloadedBytes: null,
  downloadTotalBytes: null
}

let intervalHandle: NodeJS.Timeout | null = null
let initialTimeoutHandle: NodeJS.Timeout | null = null

function publicState(): UpdaterStatus {
  return {
    state: internal.state,
    currentVersion: app.getVersion(),
    availableVersion: internal.manifest?.app.version ?? null,
    sizeBytes: internal.manifest?.app.sizeBytes ?? null,
    lastCheckedAt: internal.lastCheckedAt,
    lastError: internal.lastError,
    downloadedBytes: internal.downloadedBytes,
    downloadTotalBytes: internal.downloadTotalBytes
  }
}

function broadcastStatus(): void {
  const payload = publicState()
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IpcChannel.UpdaterStatusChanged, payload)
    }
  }
}

function setState(next: UpdaterState): void {
  const prev = internal.state
  internal.state = next
  broadcastStatus()
  // Fire user-facing notifications on the transitions that change what the
  // user can / should do, not on every internal state move. Done lazily here
  // (not in a separate state-machine module) because there are only three
  // transitions worth surfacing.
  try {
    // Lazy import to avoid loading dispatch.ts during early boot before the
    // BrowserWindow exists.
    import('../notifications/dispatch')
      .then(({ notify }) => {
        if (prev !== 'update-available' && next === 'update-available') {
          const v = internal.manifest?.app.version ?? ''
          notify({
            severity: 'info',
            source: 'updater',
            title: v ? `Update available — v${v}` : 'Update available',
            body: 'Click to install. The current session will restart.',
            action: { kind: 'navigate', target: '/settings#updates' }
          })
        } else if (prev !== 'error' && next === 'error') {
          notify({
            severity: 'error',
            source: 'updater',
            title: 'Update download failed',
            body: internal.lastError ?? 'Unknown error.',
            action: { kind: 'navigate', target: '/settings#updates' }
          })
        }
      })
      .catch(() => {})
  } catch {
    /* swallow */
  }
}

export function getStatus(): UpdaterStatus {
  return publicState()
}

export async function checkForUpdate(): Promise<UpdaterStatus> {
  // Prevent concurrent checks from racing each other.
  if (internal.state === 'checking' || internal.state === 'downloading') {
    return publicState()
  }
  if (!app.isPackaged) {
    setState('disabled-dev')
    return publicState()
  }

  setState('checking')
  try {
    const manifest = await fetchManifest()
    internal.manifest = manifest
    internal.lastCheckedAt = new Date().toISOString()
    internal.lastError = null
    const cmp = compareSemver(manifest.app.version, app.getVersion())
    setState(cmp > 0 ? 'update-available' : 'up-to-date')
  } catch (err) {
    const msg = (err as Error).message
    internal.lastError = msg
    internal.lastCheckedAt = new Date().toISOString()
    setState('error')
    recordError({
      source: 'main',
      severity: 'warning',
      message: `Update check failed: ${msg}`,
      category: 'updater'
    })
  }
  return publicState()
}

export async function applyUpdate(): Promise<UpdaterStatus> {
  if (internal.state !== 'update-available') {
    return publicState()
  }
  const stub = internal.manifest?.stub
  if (!stub || !stub.url) {
    internal.lastError = 'Manifest does not include a stub URL'
    setState('error')
    return publicState()
  }
  if (!stub.sha256 || !/^[0-9a-fA-F]{64}$/.test(stub.sha256)) {
    internal.lastError = 'Manifest stub.sha256 is missing or malformed'
    setState('error')
    return publicState()
  }

  internal.downloadedBytes = 0
  internal.downloadTotalBytes = stub.sizeBytes ?? null
  setState('downloading')
  let lastBroadcast = 0
  try {
    const path = await downloadStub(stub.url, stub.sha256, (bytes, totalBytes) => {
      internal.downloadedBytes = bytes
      // Headers may carry a more accurate total than the manifest stub.sizeBytes
      // (e.g. CDN reports content-length); prefer the live value when present.
      if (totalBytes !== null) internal.downloadTotalBytes = totalBytes
      const now = Date.now()
      if (now - lastBroadcast >= PROGRESS_BROADCAST_INTERVAL_MS) {
        lastBroadcast = now
        broadcastStatus()
      }
    })
    setState('ready')
    // Launch + quit. Renderer sees 'ready' for ~250ms before the app exits;
    // Settings can show "Restarting..." in that window if it cares.
    launchAndQuit(path)
  } catch (err) {
    const msg = (err as Error).message
    internal.lastError = msg
    internal.downloadedBytes = null
    internal.downloadTotalBytes = null
    setState('error')
    recordError({
      source: 'main',
      severity: 'error',
      message: `Update download failed: ${msg}`,
      category: 'updater'
    })
  }
  return publicState()
}

export function startUpdater(): void {
  if (!app.isPackaged) {
    setState('disabled-dev')
    return
  }
  initialTimeoutHandle = setTimeout(() => {
    void checkForUpdate()
  }, INITIAL_CHECK_DELAY_MS)
  intervalHandle = setInterval(() => {
    void checkForUpdate()
  }, CHECK_INTERVAL_MS)
}

export function stopUpdater(): void {
  if (initialTimeoutHandle) {
    clearTimeout(initialTimeoutHandle)
    initialTimeoutHandle = null
  }
  if (intervalHandle) {
    clearInterval(intervalHandle)
    intervalHandle = null
  }
}
