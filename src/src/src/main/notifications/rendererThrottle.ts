/**
 * Throttle + benign-pattern logic for renderer-uncaught-error notifications.
 *
 * Lives in its own module (no Electron imports) so vitest can import the
 * helpers directly without pulling in `ipcMain` and the dispatch chain.
 *
 * Why throttle: a renderer bug that throws inside a render loop or a polling
 * effect can fire `recordRendererError` thousands of times in a few seconds.
 * Without a guard, every event would pop a Windows toast and a row in the
 * bell drawer — the user would dismiss them as spam and miss the actual
 * signal. AppErrors (recorded unconditionally elsewhere) keeps the full
 * audit trail; the notification surface is the curated "you should look
 * at this" channel.
 *
 * Fingerprint = (category, first 200 chars of message), separated by US
 * (Unit Separator, U+001F) so a literal `|` in either field — or a category
 * that's `null` vs `""` — can't produce a key collision.
 */

const COOLDOWN_MS = 60_000
const FP_CAP = 200
const FP_TRIM_COUNT = 50
const SEP = '\x1F'

const lastNotify = new Map<string, number>()

// Renderer-side "errors" that aren't actually user-actionable bugs. Anchored
// to the start (these messages always begin with the phrase) so we don't
// suppress an unrelated error that mentions the term in passing.
const BENIGN_PATTERNS: RegExp[] = [/^ResizeObserver loop/i]

export function isBenignRendererError(message: string): boolean {
  return BENIGN_PATTERNS.some((re) => re.test(message))
}

export function shouldNotifyRendererError(category: string | null, message: string): boolean {
  // null vs "" must produce different fingerprints — using a sentinel that
  // can't appear in a real category name keeps them distinct.
  const categoryKey = category === null ? `${SEP}null` : `${SEP}str:${category}`
  const fp = `${categoryKey}${SEP}${message.slice(0, 200)}`
  const now = Date.now()
  const last = lastNotify.get(fp)
  if (last !== undefined && now - last < COOLDOWN_MS) return false
  lastNotify.set(fp, now)
  if (lastNotify.size > FP_CAP) {
    // LRU eviction: sort by last-seen timestamp ascending, drop the oldest.
    // Map iteration order is insertion order in V8, so two entries with the
    // same timestamp are tie-broken by insertion — predictable enough that
    // the cap test doesn't depend on Array.sort stability assumptions.
    const entries = [...lastNotify.entries()].sort((a, b) => a[1] - b[1])
    for (const [k] of entries.slice(0, FP_TRIM_COUNT)) {
      lastNotify.delete(k)
    }
  }
  return true
}

// Test-only. Resets the cooldown map so each test starts with no history.
export function _resetRendererNotifyState(): void {
  lastNotify.clear()
}
