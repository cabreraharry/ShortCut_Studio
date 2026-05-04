import { app, net } from 'electron'
import { spawn } from 'node:child_process'
import { createReadStream, createWriteStream, unlinkSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const STUB_FILENAME = 'ShortCut-Studio-Update.exe'

// Hard cap on the stub download. Real stubs are ~1–2 MB; 16 MB is a generous
// safety margin that still prevents a malicious or compromised CDN from
// streaming gigabytes onto the user's disk before the SHA-256 check would
// have rejected it anyway. Without a cap, a failing-but-streaming response
// can fill the temp drive before we ever reach the verify step.
const MAX_STUB_BYTES = 16 * 1024 * 1024

// Download the stub installer to %TEMP%, verify SHA-256 against the manifest,
// and prepare to launch it. Resolves with the path on disk; caller decides
// when to launch + quit. Refuses to return a path if the hash doesn't match
// — the binary is deleted and an error is thrown. CloudFront/S3 compromise,
// MITM, or a partial write would all surface here as a hash mismatch rather
// than launching arbitrary code with elevation.
//
// On any failure path (download error, size cap, hash mismatch) the partial
// file at $TEMP/STUB_FILENAME is removed. Without this, a subsequent retry
// could be confused by a stale partial — or worse, a previous run's
// hash-mismatched binary could sit there indefinitely if cleanup were
// delegated to the OS.
export async function downloadStub(
  stubUrl: string,
  expectedSha256: string,
  onProgress?: (bytes: number, totalBytes: number | null) => void
): Promise<string> {
  const dest = join(tmpdir(), STUB_FILENAME)
  // Pre-clean: a stale stub from a previous failed run would otherwise be
  // re-hashed, fail, get deleted, but only after wasted work. Cheaper to
  // start from a known-empty slot.
  try { unlinkSync(dest) } catch { /* best-effort; missing is fine */ }
  try {
    await downloadToFile(stubUrl, dest, onProgress)
  } catch (err) {
    try { unlinkSync(dest) } catch { /* best-effort */ }
    throw err
  }
  let actual: string
  try {
    actual = await sha256File(dest)
  } catch (err) {
    try { unlinkSync(dest) } catch { /* best-effort */ }
    throw err
  }
  if (actual.toLowerCase() !== expectedSha256.toLowerCase()) {
    try { unlinkSync(dest) } catch { /* best-effort cleanup */ }
    throw new Error(
      `Stub SHA-256 mismatch — refusing to launch. Expected ${expectedSha256.slice(0, 16)}…, got ${actual.slice(0, 16)}…`
    )
  }
  return dest
}

function sha256File(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(path)
    stream.on('data', (chunk) => {
      hash.update(chunk)
    })
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

// Spawn the downloaded stub as a detached process and quit the running app.
// The stub takes over from there: re-fetches manifest, downloads payload,
// reinstalls over the existing install location (NSIS detects the existing
// install via Add/Remove Programs registry keys).
export function launchAndQuit(stubPath: string): void {
  const child = spawn(stubPath, [], {
    detached: true,
    stdio: 'ignore'
  })
  child.unref()
  // Brief grace period so the child has time to actually start before we
  // exit; without it Windows sometimes terminates the spawned process when
  // its parent dies.
  setTimeout(() => app.quit(), 250)
}

function downloadToFile(
  url: string,
  dest: string,
  onProgress?: (bytes: number, totalBytes: number | null) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = createWriteStream(dest)
    const req = net.request({ method: 'GET', url })
    let total = 0
    let aborted = false
    // Attach the close listener up-front: writeStreams may emit 'close'
    // synchronously after a fast-drain end(), and a listener attached
    // inside res.on('end') would miss it and the Promise would hang.
    stream.once('close', () => {
      if (aborted) return
      resolve()
    })
    const abortAll = (reason: Error) => {
      if (aborted) return
      aborted = true
      try { req.abort() } catch { /* best-effort */ }
      try { stream.destroy() } catch { /* best-effort */ }
      reject(reason)
    }
    req.on('response', (res) => {
      const status = res.statusCode ?? 0
      if (status >= 400) {
        // Abort the request so we don't drain a multi-MB error body across
        // a slow connection just to throw the bytes away.
        abortAll(new Error(`HTTP ${status} from stub URL`))
        return
      }
      const contentLengthHeader = res.headers['content-length']
      const totalBytes =
        typeof contentLengthHeader === 'string'
          ? parseInt(contentLengthHeader, 10) || null
          : Array.isArray(contentLengthHeader)
            ? parseInt(contentLengthHeader[0] ?? '', 10) || null
            : null
      if (totalBytes !== null && totalBytes > MAX_STUB_BYTES) {
        abortAll(new Error(`Stub Content-Length ${totalBytes} exceeds ${MAX_STUB_BYTES} byte cap`))
        return
      }
      res.on('data', (chunk: Buffer) => {
        if (aborted) return
        total += chunk.length
        if (total > MAX_STUB_BYTES) {
          abortAll(new Error(`Stub download exceeded ${MAX_STUB_BYTES} byte cap`))
          return
        }
        stream.write(chunk)
        if (onProgress) onProgress(total, totalBytes)
      })
      res.on('end', () => {
        if (aborted) return
        // The 'close' listener attached up-front resolves the Promise.
        stream.end()
      })
      res.on('error', (err) => abortAll(err))
    })
    req.on('error', (err) => abortAll(err))
    req.end()
  })
}
