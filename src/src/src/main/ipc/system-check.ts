import { ipcMain, net } from 'electron'
import { existsSync, readdirSync } from 'node:fs'
import { IpcChannel } from '@shared/ipc-channels'
import type { SystemCheckItem, SystemCheckResult } from '@shared/types'
import { resolveWorkersDir } from '../workers/config'

const EXPECTED_WORKER_EXES = [
  'root_watchdog.exe',
  'topic_watchdog.exe',
  'gemini_processor.exe'
]

function checkWorkers(): SystemCheckItem {
  const dir = resolveWorkersDir()
  if (!existsSync(dir)) {
    return {
      status: 'missing',
      detail: `Workers directory not found: ${dir}`,
      hintLabel: 'See Dev mode → Workers tab'
    }
  }
  let found: string[] = []
  try {
    found = readdirSync(dir)
  } catch {
    return { status: 'error', detail: `Unable to read ${dir}` }
  }
  const missing = EXPECTED_WORKER_EXES.filter((e) => !found.includes(e))
  if (missing.length > 0) {
    return {
      status: 'missing',
      detail: `Missing: ${missing.join(', ')} in ${dir}`
    }
  }
  return {
    status: 'ok',
    detail: `Found 3/3 workers at ${dir}`
  }
}

function checkOllama(): Promise<SystemCheckItem> {
  return new Promise((resolve) => {
    const req = net.request({
      method: 'GET',
      url: 'http://127.0.0.1:11434/api/version'
    })
    const timer = setTimeout(() => {
      req.abort()
      resolve({
        status: 'missing',
        detail: 'No response on localhost:11434',
        hintLabel: 'Download Ollama',
        hintUrl: 'https://ollama.com/download'
      })
    }, 2_000)
    let body = ''
    req.on('response', (res) => {
      res.on('data', (chunk) => {
        body += chunk.toString()
      })
      res.on('end', () => {
        clearTimeout(timer)
        try {
          const parsed = JSON.parse(body) as { version?: string }
          resolve({
            status: 'ok',
            version: parsed.version,
            detail: 'Running on localhost:11434'
          })
        } catch {
          resolve({
            status: 'error',
            detail: 'Ollama responded but the payload was unexpected'
          })
        }
      })
    })
    req.on('error', () => {
      clearTimeout(timer)
      resolve({
        status: 'missing',
        detail: 'Not installed or not running on :11434',
        hintLabel: 'Download Ollama',
        hintUrl: 'https://ollama.com/download'
      })
    })
    req.end()
  })
}

const RESERVED_IPFS: SystemCheckItem = {
  status: 'reserved',
  detail:
    'Planned for v2 (peer network / ExecEngine integration). Not invoked today.'
}

const RESERVED_NGINX: SystemCheckItem = {
  status: 'reserved',
  detail:
    'Not referenced by the app today. Will likely arrive with the ExecEngine integration.'
}

export function registerSystemCheckHandlers(): void {
  ipcMain.handle(
    IpcChannel.DevSystemCheck,
    async (): Promise<SystemCheckResult> => {
      const [workers, ollama] = await Promise.all([
        Promise.resolve(checkWorkers()),
        checkOllama()
      ])
      return {
        workers,
        ollama,
        ipfs: RESERVED_IPFS,
        nginx: RESERVED_NGINX
      }
    }
  )
}
