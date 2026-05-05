import { net, shell } from 'electron'
import { assertNotExecutable, assertOnLocalDrive, canonicalize } from '../security/safePath'

const LH_OPEN_FILE = 'http://127.0.0.1:18866/open_file'
const LH_EXPLORER = 'http://127.0.0.1:18877/explorer'
const TIMEOUT_MS = 1000

function tryLocalhost(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = net.request({ method: 'GET', url })
    let settled = false
    const done = (ok: boolean): void => {
      if (settled) return
      settled = true
      resolve(ok)
    }
    const timer = setTimeout(() => {
      try {
        req.abort()
      } catch {
        /* ignore */
      }
      done(false)
    }, TIMEOUT_MS)
    req.on('response', (resp) => {
      clearTimeout(timer)
      resp.on('data', () => { /* drain */ })
      resp.on('end', () => done(resp.statusCode >= 200 && resp.statusCode < 400))
    })
    req.on('error', () => {
      clearTimeout(timer)
      done(false)
    })
    req.end()
  })
}

export async function openFile(path: string): Promise<{ via: 'localhost' | 'shell' | 'none' }> {
  // Validate before either branch. The localhost helper at 127.0.0.1:18866
  // accepts any string; without this check, a renderer XSS could ShellExecute
  // calc.exe via the SCL_Demo helper just as easily as via shell.openPath.
  // assertNotExecutable applies to both: the localhost helper also goes
  // through ShellExecute server-side. assertOnLocalDrive blocks the
  // path.resolve() coercion of a relative path like 'foo' to D:\foo
  // (current drive); without it, a renderer-supplied relative path could
  // open something the user didn't intend.
  const safe = canonicalize(path)
  assertNotExecutable(safe)
  await assertOnLocalDrive(safe)
  const url = `${LH_OPEN_FILE}?file=${encodeURIComponent(safe)}`
  if (await tryLocalhost(url)) return { via: 'localhost' }
  const errMsg = await shell.openPath(safe)
  return { via: errMsg === '' ? 'shell' : 'none' }
}

export async function revealFolder(path: string): Promise<{ via: 'localhost' | 'shell' }> {
  // No assertNotExecutable here — revealFolder shows the file's containing
  // directory in Explorer, never executes anything. But the same
  // assertOnLocalDrive guard as openFile applies: a relative path like
  // 'foo' would resolve to D:\foo (current drive) and open Explorer at
  // an unexpected location.
  const safe = canonicalize(path)
  await assertOnLocalDrive(safe)
  const url = `${LH_EXPLORER}?folder=${encodeURIComponent(safe)}`
  if (await tryLocalhost(url)) return { via: 'localhost' }
  shell.showItemInFolder(safe)
  return { via: 'shell' }
}
