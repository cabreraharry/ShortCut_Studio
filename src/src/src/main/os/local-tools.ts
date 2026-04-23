import { net, shell } from 'electron'

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
  const url = `${LH_OPEN_FILE}?file=${encodeURIComponent(path)}`
  if (await tryLocalhost(url)) return { via: 'localhost' }
  const errMsg = await shell.openPath(path)
  return { via: errMsg === '' ? 'shell' : 'none' }
}

export async function revealFolder(path: string): Promise<{ via: 'localhost' | 'shell' }> {
  const url = `${LH_EXPLORER}?folder=${encodeURIComponent(path)}`
  if (await tryLocalhost(url)) return { via: 'localhost' }
  shell.showItemInFolder(path)
  return { via: 'shell' }
}
