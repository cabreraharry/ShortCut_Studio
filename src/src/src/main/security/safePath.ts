import { resolve } from 'node:path'
import { listDrives } from '../os/drives'

/**
 * Path-safety helpers for handlers that take renderer-supplied paths and
 * pass them to fs.* / shell.openPath / shell.showItemInFolder.
 *
 * Threat model: a compromised renderer (XSS via a malicious npm dep in
 * the renderer bundle, DevTools-injected script, or a hijacked update
 * channel that swapped renderer assets). The renderer can call any
 * window.electronAPI method; without input validation on the main side,
 * a path-handling channel becomes ShellExecute-on-anything (RCE) or
 * directory-enumerate-anything (drive scan).
 *
 * Three layers, applied per-handler depending on what it does:
 *   - canonicalize:        reject NUL/empty/UNC; resolve to absolute
 *   - assertNotExecutable: refuse ShellExecute on .exe/.bat/.lnk/etc.
 *   - assertOnLocalDrive:  refuse paths outside the OS-detected local drives
 */

// ShellExecute on these extensions launches the file. Anything else is
// either opened in its registered viewer (Office, browser, etc.) or
// produces a harmless "no application associated with this file."
//
// The list is conservative — it covers the well-known exec-on-Windows
// extensions plus the script extensions WSH will run. False positives
// (refusing to open a legitimate .js the user added) are acceptable;
// false negatives (allowing .scr through) are not.
const EXECUTABLE_EXTENSIONS = new Set<string>([
  '.exe',
  '.bat',
  '.cmd',
  '.com',
  '.scr',
  '.lnk',
  '.pif',
  '.ps1',
  '.psm1',
  '.psd1',
  '.vbs',
  '.vbe',
  '.js',
  '.jse',
  '.wsf',
  '.wsh',
  '.msi',
  '.msp',
  '.reg',
  '.cpl',
  '.gadget',
  '.msc',
  '.hta',
  '.application',
  '.appref-ms'
])

export class UnsafePathError extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = 'UnsafePathError'
  }
}

/**
 * Canonicalize a renderer-supplied path. Returns the resolved absolute
 * form. Throws UnsafePathError on inputs that are empty, contain NUL
 * (which better-sqlite3 truncates and Windows APIs handle inconsistently),
 * or are UNC paths (`\\server\share` could point at attacker-controlled
 * SMB; nothing in SCS legitimately produces one from the renderer).
 */
export function canonicalize(input: unknown): string {
  if (typeof input !== 'string') {
    throw new UnsafePathError('path must be a string')
  }
  if (input.length === 0) {
    throw new UnsafePathError('path required')
  }
  if (input.includes('\0')) {
    throw new UnsafePathError('path contains NUL')
  }
  if (input.startsWith('\\\\') || input.startsWith('//')) {
    throw new UnsafePathError('UNC paths not allowed')
  }
  return resolve(input)
}

/**
 * Refuse paths whose extension is in the executable allowlist. Apply
 * before any shell.openPath call — that's the codepath that ShellExecutes
 * the file rather than opening it in its registered viewer.
 */
export function assertNotExecutable(path: string): void {
  const idx = path.lastIndexOf('.')
  if (idx === -1) return
  const ext = path.substring(idx).toLowerCase()
  if (EXECUTABLE_EXTENSIONS.has(ext)) {
    throw new UnsafePathError(`refusing to open executable file (${ext})`)
  }
}

/**
 * Verify the canonical path is rooted on one of the OS-detected local
 * drive letters. Cheap defense against UNC bypass, unusual mount points,
 * or device paths. Async because listDrives queries statfs.
 */
export async function assertOnLocalDrive(path: string): Promise<void> {
  const drives = await listDrives()
  const lower = path.toLowerCase()
  const allowed = drives.map((d) => `${d.letter.toLowerCase()}:\\`)
  if (!allowed.some((root) => lower.startsWith(root))) {
    throw new UnsafePathError(`path not on a known local drive: ${path}`)
  }
}
