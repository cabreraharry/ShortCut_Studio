import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { app } from 'electron'

// Persistent install-id used for staged-rollout cohort assignment + telemetry
// correlation. The manifest Lambda hashes this to decide whether a request
// lands in the staged channel — without a stable id, every fetch flaps between
// stable and beta because there's no consistent hash input.
//
// Persisted to %LocalAppData%\ShortCut Studio\install-id (i.e. inside
// app.getPath('userData')). NSIS keeps the userData dir intact across
// reinstalls of the same productName, so cohort assignment survives an
// upgrade-in-place. A fresh userData wipe (uninstall + clean reinstall) gets
// a new id, which is the desired behavior — that user is genuinely a new
// install for analytics purposes.
//
// 16 random bytes → 32 hex chars; the manifest Lambda only reads the first
// 4 bytes for hashmod-100, so even modest entropy is plenty.

const INSTALL_ID_FILENAME = 'install-id'
const INSTALL_ID_BYTES = 16

let cached: string | null = null

function installIdPath(): string {
  return join(app.getPath('userData'), INSTALL_ID_FILENAME)
}

function readExisting(path: string): string | null {
  try {
    if (!existsSync(path)) return null
    const raw = readFileSync(path, 'utf-8').trim()
    if (/^[0-9a-f]{32}$/.test(raw)) return raw
  } catch {
    /* unreadable — fall through */
  }
  return null
}

export function getInstallId(): string {
  if (cached) return cached
  const path = installIdPath()
  const found = readExisting(path)
  if (found) {
    cached = found
    return cached
  }
  // First-time create. Use `flag: 'wx'` so a concurrent second instance
  // racing against this one gets EEXIST and re-reads the winning value.
  // Without this both instances would generate different ids and the last
  // writer would clobber the other — leaving one instance running with an
  // in-memory id different from what's on disk, which means a future
  // restart picks up the loser's id and the cohort assignment flaps.
  const fresh = randomBytes(INSTALL_ID_BYTES).toString('hex')
  try {
    mkdirSync(join(path, '..'), { recursive: true })
    writeFileSync(path, fresh + '\n', { encoding: 'utf-8', flag: 'wx' })
    cached = fresh
    return cached
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code
    if (code === 'EEXIST') {
      // Lost the race against another instance — re-read; the winner's
      // value is what's on disk now.
      const winner = readExisting(path)
      if (winner) {
        cached = winner
        return cached
      }
    }
    // Truly unwritable userData: degrade to a session-only id rather than
    // throwing. Next launch retries persistence; meanwhile the running app
    // still has *some* id for cohort + telemetry consistency in this run.
    cached = fresh
    return cached
  }
}
