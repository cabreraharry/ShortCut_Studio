import { spawn, type ChildProcess } from 'node:child_process'
import { app, net } from 'electron'
import type { WorkerStatus } from '@shared/types'
import { sclDataRootDir } from '../db/scl-folder'
import { recordError } from '../diagnostics/errorStore'
import { LLM_BRIDGE_PORT } from '../llm/bridgeServer'
import {
  SUPERVISED_WORKERS,
  resolveWorkerExecutable,
  type WorkerConfig
} from './config'

/**
 * Long-running worker supervisor.
 *
 * Responsibilities:
 * - Start auto-start workers when the app boots
 * - Capture stdout/stderr and keep a rolling log buffer
 * - Restart on unexpected exit, with exponential backoff (max retries)
 * - Poll each worker's FastAPI /health endpoint to detect hung processes
 * - Expose status + log tail for the Diagnostics panel
 *
 * The Python-side FastAPI wrapper lives at SCL_Demo/tools/worker_api.py.
 * Workers that haven't adopted the wrapper yet still work — they just
 * never respond to health pings, so status is inferred purely from
 * whether the child process is alive.
 */

interface WorkerHandle {
  config: WorkerConfig
  child: ChildProcess | null
  status: WorkerStatus['status']
  lastHealthCheck?: number
  exitCode?: number
  restartCount: number
  logBuffer: string[]
}

const LOG_RING = 400
const MAX_RESTART_ATTEMPTS = 5
const HEALTH_POLL_MS = 10_000

const handles = new Map<string, WorkerHandle>()
let healthInterval: NodeJS.Timeout | null = null

function initHandle(cfg: WorkerConfig): WorkerHandle {
  return {
    config: cfg,
    child: null,
    status: 'stopped',
    restartCount: 0,
    logBuffer: []
  }
}

function pushLog(handle: WorkerHandle, line: string) {
  handle.logBuffer.push(line)
  if (handle.logBuffer.length > LOG_RING) {
    handle.logBuffer.splice(0, handle.logBuffer.length - LOG_RING)
  }
}

function spawnWorker(handle: WorkerHandle): void {
  const cfg = handle.config
  const exe = resolveWorkerExecutable(cfg)
  if (!exe) {
    pushLog(
      handle,
      `[supervisor] skipping ${cfg.name} — executable not found. Set SCL_WORKERS_DIR or build SCL_Demo/_exe/${cfg.executable}.`
    )
    handle.status = 'stopped'
    return
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    WORKER_HEALTH_PORT: String(cfg.healthPort),
    // Tell the worker where Electron's loopback LLM bridge is listening.
    // Workers route all completion calls through the bridge so they don't
    // hold provider API keys themselves.
    ELECTRON_LLM_BRIDGE_PORT: String(LLM_BRIDGE_PORT)
  }
  // In packaged builds, point the Python worker's data-root resolver at the
  // per-user seed location. Without this, the resolver walks up from
  // sys.executable looking for a `db_files/` ancestor — which doesn't exist
  // in the install layout (resources/workers/<exe> has no sibling db_files/).
  // Dev runs leave the env var unset so the resolver uses its dev default
  // (the sibling SCL_Demo project at D:/Client-Side_Project/SCL_Demo/).
  if (app.isPackaged) {
    env['SCL_DEMO_DATA_ROOT'] = sclDataRootDir()
  }
  const child = spawn(exe, cfg.args, { env, windowsHide: true })
  handle.child = child
  handle.status = 'running'
  pushLog(handle, `[supervisor] started ${cfg.name} (pid=${child.pid})`)

  child.stdout?.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split(/\r?\n/)) {
      if (line.trim()) pushLog(handle, line)
    }
  })
  child.stderr?.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split(/\r?\n/)) {
      if (line.trim()) pushLog(handle, line)
    }
  })
  child.on('exit', (code) => {
    handle.child = null
    handle.exitCode = code ?? undefined
    const crashed = code !== 0 && code !== null
    handle.status = crashed ? 'crashed' : 'stopped'
    pushLog(handle, `[supervisor] ${cfg.name} exited (code=${code})`)
    if (crashed) {
      recordError({
        source: 'worker',
        severity: 'error',
        category: cfg.name,
        message: `exited code=${code}`,
        context: {
          code,
          restartCount: handle.restartCount,
          lastLogs: handle.logBuffer.slice(-20)
        }
      })
    }
    if (crashed && handle.restartCount < MAX_RESTART_ATTEMPTS) {
      const delay = Math.min(30_000, 2_000 * Math.pow(2, handle.restartCount))
      handle.restartCount += 1
      pushLog(handle, `[supervisor] restarting in ${delay}ms (attempt ${handle.restartCount})`)
      setTimeout(() => spawnWorker(handle), delay)
    } else if (crashed) {
      pushLog(handle, `[supervisor] giving up on ${cfg.name} after ${handle.restartCount} restarts`)
      recordError({
        source: 'worker',
        severity: 'error',
        category: cfg.name,
        message: `gave up after ${handle.restartCount} restarts`,
        context: { code, restartCount: handle.restartCount }
      })
    }
  })
}

async function pingHealth(handle: WorkerHandle): Promise<void> {
  if (handle.status !== 'running' || !handle.child) return
  const port = handle.config.healthPort
  try {
    await new Promise<void>((resolve, reject) => {
      const req = net.request({
        method: 'GET',
        url: `http://127.0.0.1:${port}/health`
      })
      const timer = setTimeout(() => {
        req.abort()
        reject(new Error('timeout'))
      }, 3_000)
      req.on('response', (res) => {
        res.on('data', () => {})
        res.on('end', () => {
          clearTimeout(timer)
          if (res.statusCode && res.statusCode < 500) resolve()
          else reject(new Error(`HTTP ${res.statusCode}`))
        })
      })
      req.on('error', (err) => {
        clearTimeout(timer)
        reject(err)
      })
      req.end()
    })
    handle.lastHealthCheck = Date.now()
  } catch {
    // Endpoint not responding — worker may not have adopted the FastAPI
    // wrapper yet. Don't treat as crash unless the process itself has died.
  }
}

export function startWorkerSupervisor(): void {
  for (const cfg of SUPERVISED_WORKERS) {
    const handle = initHandle(cfg)
    handles.set(cfg.name, handle)
    if (cfg.autoStart) spawnWorker(handle)
  }

  if (healthInterval) clearInterval(healthInterval)
  healthInterval = setInterval(() => {
    for (const handle of handles.values()) pingHealth(handle)
  }, HEALTH_POLL_MS)
}

export function stopAllWorkers(): void {
  if (healthInterval) {
    clearInterval(healthInterval)
    healthInterval = null
  }
  for (const handle of handles.values()) {
    if (handle.child && !handle.child.killed) {
      handle.child.kill()
    }
    handle.status = 'stopped'
  }
}

export function getWorkerStatuses(): WorkerStatus[] {
  const out: WorkerStatus[] = []
  for (const handle of handles.values()) {
    out.push({
      name: handle.config.name,
      pid: handle.child?.pid,
      status: handle.status,
      lastHealthCheck: handle.lastHealthCheck,
      exitCode: handle.exitCode,
      restartCount: handle.restartCount
    })
  }
  return out
}

export async function restartWorker(name: string): Promise<void> {
  const handle = handles.get(name)
  if (!handle) return
  if (handle.child && !handle.child.killed) {
    handle.child.kill()
    // spawn happens via the 'exit' handler if crashed — but here it's a
    // deliberate restart, so kick off ourselves after a short delay.
    await new Promise((r) => setTimeout(r, 500))
  }
  handle.restartCount = 0
  spawnWorker(handle)
}

export async function tailWorkerLog(name: string, lines: number): Promise<string> {
  const handle = handles.get(name)
  if (!handle) return `(no worker named ${name})`
  const n = Math.max(1, Math.min(LOG_RING, lines))
  return handle.logBuffer.slice(-n).join('\n')
}
