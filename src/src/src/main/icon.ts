import { app } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Resolve the app icon (icon.ico) for both dev and packaged builds.
 *
 * Probes a small list of candidate locations and returns the first one that
 * exists on disk. Used by the tray, the BrowserWindow, and any other place
 * that needs the app's display icon.
 *
 * - Dev: `__dirname` is `<repo>/out/main/`; the icon lives at `<repo>/resources/icon.ico`
 *   (i.e. `../../resources/icon.ico` from __dirname).
 * - Packaged: electron-builder.yml extraResources copies `resources/icon.ico` to
 *   `process.resourcesPath/icon.ico`.
 *
 * If nothing matches we still return the dev path so callers can pass it to
 * `nativeImage.createFromPath`, which gracefully returns an empty image — and
 * tray.ts logs a warning when that happens.
 */
export function resolveAppIconPath(): string {
  const candidates = [
    join(process.resourcesPath ?? '', 'icon.ico'),
    join(__dirname, '../../resources/icon.ico'),
    join(__dirname, '../../../resources/icon.ico'),
    join(app.getAppPath(), 'resources/icon.ico')
  ]
  return candidates.find((p) => p && existsSync(p)) ?? candidates[1]
}
