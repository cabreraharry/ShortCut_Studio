import { net } from 'electron'
import type { WebStubManifest } from '@shared/web-stub-manifest'
import { redactSecrets } from '../security/redact'
import { getInstallId } from './installId'

// Manifest URL — read from the same endpoint the NSIS stub hits. Phase 3's
// terraform output `api_endpoint` overrides this once the AWS infra is up.
// Until then this resolves to `.invalid`, which fails the URL phase fast and
// the updater reports "error" without spamming the network.
export const MANIFEST_URL =
  process.env.SCS_MANIFEST_URL || 'https://updates.shortcutstudio.invalid/v1/manifest.json'

// Hard cap on the manifest response body. Live manifest is ~2 KB; 64 KB is
// a generous safety margin. Without this, a malicious or compromised endpoint
// could stream gigabytes into RAM and OOM the main process.
const MAX_MANIFEST_BYTES = 64 * 1024

function appendInstallId(url: string): string {
  // Pass ?installId=<hex> so the manifest Lambda's staged-rollout cohort
  // assignment is stable per install. Without this, every fetch hashes an
  // empty id, which always returns the requested channel — staged rollouts
  // silently no-op for in-app updates.
  let id: string
  try {
    id = getInstallId()
  } catch {
    return url
  }
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}installId=${encodeURIComponent(id)}`
}

export async function fetchManifest(url: string = MANIFEST_URL): Promise<WebStubManifest> {
  return new Promise((resolve, reject) => {
    const req = net.request({ method: 'GET', url: appendInstallId(url) })
    let body = ''
    let bytes = 0
    let aborted = false
    req.on('response', (res) => {
      const status = res.statusCode ?? 0
      if (status >= 400) {
        reject(new Error(`HTTP ${status} from manifest endpoint`))
        return
      }
      res.on('data', (chunk: Buffer) => {
        if (aborted) return
        bytes += chunk.length
        if (bytes > MAX_MANIFEST_BYTES) {
          aborted = true
          try { req.abort() } catch { /* best-effort */ }
          reject(new Error(`Manifest exceeds ${MAX_MANIFEST_BYTES} byte cap`))
          return
        }
        body += chunk.toString('utf-8')
      })
      res.on('end', () => {
        if (aborted) return
        try {
          const parsed = JSON.parse(body) as WebStubManifest
          resolve(parsed)
        } catch (err) {
          reject(new Error(`Invalid JSON from manifest: ${(err as Error).message}`))
        }
      })
      res.on('error', (err) => reject(err))
    })
    req.on('error', (err) => {
      // Errors here surface to the AppErrors panel; redact in case the URL
      // ever picks up an embedded query secret. Our manifest URL doesn't,
      // but defensive.
      reject(new Error(redactSecrets(err.message)))
    })
    req.end()
  })
}

// SemVer comparison with proper pre-release ordering per semver.org §11:
//   1.0.0-alpha < 1.0.0-alpha.1 < 1.0.0-beta < 1.0.0-rc.1 < 1.0.0
//
// The earlier implementation stripped pre-release suffixes entirely, which
// meant '0.5.0-beta.1' compared equal to '0.5.0' — a beta-channel user would
// never get auto-promoted to stable when the same version number shipped
// without the suffix. With proper ordering, '0.5.0' > '0.5.0-beta.1' as
// expected, so beta→stable migration auto-fires.
export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  // Split at the FIRST '-' only — `'1.0.0-rc.1-hotfix'` should preserve the
  // full pre-release identifier `'rc.1-hotfix'`. `String.prototype.split('-', 2)`
  // would silently drop everything after the second '-'.
  const splitAtFirstDash = (s: string): [string, string | undefined] => {
    const idx = s.indexOf('-')
    return idx < 0 ? [s, undefined] : [s.slice(0, idx), s.slice(idx + 1)]
  }
  const [aMain, aPre] = splitAtFirstDash(a)
  const [bMain, bPre] = splitAtFirstDash(b)
  const aMainParts = aMain.split('.').map((p) => parseInt(p, 10) || 0)
  const bMainParts = bMain.split('.').map((p) => parseInt(p, 10) || 0)
  const len = Math.max(aMainParts.length, bMainParts.length)
  for (let i = 0; i < len; i++) {
    const av = aMainParts[i] ?? 0
    const bv = bMainParts[i] ?? 0
    if (av < bv) return -1
    if (av > bv) return 1
  }
  // Main parts equal — pre-release suffix decides. Per spec: a version with
  // a pre-release tag is LOWER than the same version without one.
  if (!aPre && !bPre) return 0
  if (!aPre) return 1   // 1.0.0 > 1.0.0-beta
  if (!bPre) return -1  // 1.0.0-beta < 1.0.0
  return comparePreRelease(aPre, bPre)
}

function comparePreRelease(a: string, b: string): -1 | 0 | 1 {
  const aIds = a.split('.')
  const bIds = b.split('.')
  const len = Math.max(aIds.length, bIds.length)
  for (let i = 0; i < len; i++) {
    const aId = aIds[i]
    const bId = bIds[i]
    // Per spec §11.4.4: a longer pre-release is greater if all preceding ids
    // are equal (e.g. alpha.1 < alpha.1.1).
    if (aId === undefined) return -1
    if (bId === undefined) return 1
    const aNum = /^\d+$/.test(aId)
    const bNum = /^\d+$/.test(bId)
    if (aNum && bNum) {
      const an = parseInt(aId, 10)
      const bn = parseInt(bId, 10)
      if (an < bn) return -1
      if (an > bn) return 1
    } else if (aNum !== bNum) {
      // Numeric identifiers always have lower precedence than alphanumerics.
      return aNum ? -1 : 1
    } else {
      if (aId < bId) return -1
      if (aId > bId) return 1
    }
  }
  return 0
}
