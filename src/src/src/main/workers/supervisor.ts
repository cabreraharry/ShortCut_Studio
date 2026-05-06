import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { app, net } from 'electron'
import type { WorkerStatus } from '@shared/types'
import { sclDataRootDir } from '../db/scl-folder'
import { recordError } from '../diagnostics/errorStore'
import { notify } from '../notifications/dispatch'
import { LLM_BRIDGE_PORT, getBridgeToken } from '../llm/bridgeServer'
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
  // Whether the most recent /health ping succeeded. Differs from
  // lastHealthCheck because a timeout updates the timestamp (so the UI knows
  // we tried) but flips this flag to false (so the UI doesn't lie about
  // "Healthy, last check 1s ago" while the worker is actually hung).
  lastHealthCheckOk?: boolean
  exitCode?: number
  restartCount: number
  // Per-handle backoff tracking. lastSuccessfulRunStart resets each time the
  // worker reaches a stable 'running' state; the health-poll interval decays
  // restartCount by 1 every BACKOFF_DECAY_MS of clean uptime so a transient
  // crash burst doesn't permanently lock the worker out.
  lastSuccessfulRunStart?: number
  // Set true while restartWorker() is intentionally killing the child, so the
  // exit handler skips its auto-respawn path and lets restartWorker do the
  // single re-spawn. Cleared once that re-spawn lands.
  manualRestartInProgress: boolean
  logBuffer: string[]
}

const LOG_RING = 400
const MAX_RESTART_ATTEMPTS = 5
const HEALTH_POLL_MS = 10_000
// Decay restartCount by 1 every hour of clean running. A worker that crashed
// 5 times due to a transient state (cold disk cache, GC pressure) but then
// stabilises gets its budget back gradually instead of staying "given up"
// until manual restart.
const BACKOFF_DECAY_MS = 60 * 60 * 1000

const handles = new Map<string, WorkerHandle>()
let healthInterval: NodeJS.Timeout | null = null
// Set in stopAllWorkers() so any in-flight crash-restart setTimeout that
// fires AFTER shutdown skips spawning — preventing the orphaned-process leak
// where Task Manager shows root_watchdog.exe still running after app quit.
//
// Intentionally module-scope and never reset: startWorkerSupervisor() is
// called exactly once per app process (from main/index.ts whenReady), and
// the process exits after stopAllWorkers(). If a future "hot restart" path
// ever calls startWorkerSupervisor() a second time, this flag would prevent
// any spawn — that path would need to reset the flag itself before calling
// in.
let isShuttingDown = false

function initHandle(cfg: WorkerConfig): WorkerHandle {
  return {
    config: cfg,
    child: null,
    status: 'stopped',
    restartCount: 0,
    manualRestartInProgress: false,
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

  // Build a minimal env for the worker process rather than spreading
  // ...process.env. Spreading the full env would propagate every secret
  // the user happens to have in their shell — AWS_ACCESS_KEY_ID,
  // GH_TOKEN, OPENAI_API_KEY (some users set this even though SCS doesn't
  // need it at the env level), arbitrary aliases, Visual Studio
  // PATH-pollution, etc. — to the worker, and from there to any grand-
  // children the worker spawns (PyInstaller's restored interpreter, OCR
  // subprocesses). The minimal-env approach limits the worker's view of
  // the parent to what Python on Windows actually needs to run.
  //
  // Note: the bridge token still flows from supervisor → worker (it has
  // to, the worker authenticates against it). Workers MUST NOT propagate
  // it to their own subprocesses — see SCL_Demo/tools/electron_llm_client.py
  // for the contract on the worker side.
  const PASSTHROUGH_KEYS = [
    'PATH',
    'SystemRoot', // case-sensitive on Windows env-block lookups in some APIs
    'WINDIR',
    'COMSPEC',
    'TEMP',
    'TMP',
    'USERPROFILE',
    'APPDATA',
    'LOCALAPPDATA',
    'HOMEDRIVE',
    'HOMEPATH',
    'USERNAME',
    'COMPUTERNAME',
    'OS',
    'PROCESSOR_ARCHITECTURE',
    'NUMBER_OF_PROCESSORS',
    // Locale + Unicode handling for PyInstaller-frozen workers. Without
    // these, Python's stdio defaults to ASCII on some Windows configs and
    // breaks on non-ASCII filenames (which is exactly what file-scan and
    // topic-naming workers receive).
    'LANG',
    'LC_ALL',
    'PYTHONIOENCODING',
    // Dev-time override that lets workers find their .exe sources at a
    // non-default path. Read by config.ts:48; pass-through keeps the dev
    // workflow unbroken even though the value is read in main, not the
    // worker process — kept for symmetry + future worker-side use.
    'SCL_WORKERS_DIR'
  ] as const

  const env: NodeJS.ProcessEnv = {}
  for (const key of PASSTHROUGH_KEYS) {
    const value = process.env[key]
    if (value !== undefined) env[key] = value
  }
  env.WORKER_HEALTH_PORT = String(cfg.healthPort)
  // Tell the worker where Electron's loopback LLM bridge is listening.
  // Workers route all completion calls through the bridge so they don't
  // hold provider API keys themselves.
  env.ELECTRON_LLM_BRIDGE_PORT = String(LLM_BRIDGE_PORT)
  // Per-launch shared secret. Workers send it as the X-SCS-Bridge-Token
  // header on every /llm/complete POST. Without this, any local process
  // could call the bridge and burn the user's API budget anonymously.
  env.ELECTRON_LLM_BRIDGE_TOKEN = getBridgeToken()
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
  handle.lastSuccessfulRunStart = Date.now()
  // Clear the manual-restart flag now that the new child is up — subsequent
  // exits revert to the normal auto-restart code path.
  handle.manualRestartInProgress = false
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
      // Soft notify — the supervisor is about to auto-restart, so this
      // is an information event ("we noticed and are recovering") not a
      // hard failure yet. Hard failure (give-up) fires below.
      const willRetry = handle.restartCount < MAX_RESTART_ATTEMPTS
      if (willRetry) {
        notify({
          severity: 'warning',
          source: 'worker',
          title: `${cfg.name} restarted`,
          body: `Crashed with code ${code}; auto-recovering.`,
          action: { kind: 'navigate', target: '/settings#diagnostics' }
        })
      }
    }
    if (handle.manualRestartInProgress) {
      // restartWorker() killed this child intentionally and will spawn the
      // replacement itself. Skip the auto-restart path so we don't end up
      // with two processes fighting for the same port.
      pushLog(handle, `[supervisor] ${cfg.name} exit absorbed by manual restart`)
      return
    }
    if (crashed && handle.restartCount < MAX_RESTART_ATTEMPTS) {
      const delay = Math.min(30_000, 2_000 * Math.pow(2, handle.restartCount))
      handle.restartCount += 1
      pushLog(handle, `[supervisor] restarting in ${delay}ms (attempt ${handle.restartCount})`)
      setTimeout(() => {
        if (isShuttingDown) {
          pushLog(handle, `[supervisor] ${cfg.name} restart skipped — app shutting down`)
          return
        }
        spawnWorker(handle)
      }, delay)
    } else if (crashed) {
      pushLog(handle, `[supervisor] giving up on ${cfg.name} after ${handle.restartCount} restarts`)
      recordError({
        source: 'worker',
        severity: 'error',
        category: cfg.name,
        message: `gave up after ${handle.restartCount} restarts`,
        context: { code, restartCount: handle.restartCount }
      })
      notify({
        severity: 'error',
        source: 'worker',
        title: `${cfg.name} stopped`,
        body: `Crashed too many times; manual restart needed in Diagnostics.`,
        action: { kind: 'navigate', target: '/settings#diagnostics' }
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
    handle.lastHealthCheckOk = true
  } catch {
    // Endpoint not responding — worker may not have adopted the FastAPI
    // wrapper yet. Don't treat as crash unless the process itself has died.
    // Update timestamp+flag so the UI can distinguish "we tried recently and
    // it didn't answer" (warning state) from "we never tried" (unknown).
    handle.lastHealthCheck = Date.now()
    handle.lastHealthCheckOk = false
  }
}

// Decay restartCount by 1 for any worker that's been cleanly running for
// BACKOFF_DECAY_MS. Called from the same interval as pingHealth so we don't
// proliferate timers.
function decayBackoff(handle: WorkerHandle): void {
  if (handle.status !== 'running' || handle.restartCount === 0) return
  if (!handle.lastSuccessfulRunStart) return
  if (Date.now() - handle.lastSuccessfulRunStart < BACKOFF_DECAY_MS) return
  handle.restartCount = Math.max(0, handle.restartCount - 1)
  handle.lastSuccessfulRunStart = Date.now()
  pushLog(
    handle,
    `[supervisor] backoff decayed; restartCount=${handle.restartCount}`
  )
}

export function startWorkerSupervisor(): void {
  for (const cfg of SUPERVISED_WORKERS) {
    const handle = initHandle(cfg)
    handles.set(cfg.name, handle)
    if (cfg.autoStart) spawnWorker(handle)
  }

  if (healthInterval) clearInterval(healthInterval)
  healthInterval = setInterval(() => {
    for (const handle of handles.values()) {
      pingHealth(handle)
      decayBackoff(handle)
    }
  }, HEALTH_POLL_MS)
}

/**
 * Force-kill a child process tree on Windows via taskkill /F /T. Falls back
 * to process.kill(pid, 'SIGKILL') on POSIX. spawnSync is intentional — this
 * is called from synchronous shutdown paths (before-quit) where we need
 * the kill to actually complete, not be queued for later.
 *
 * Important: /T tells taskkill to terminate the entire process tree, not
 * just the parent. PyInstaller-frozen .exes spawn a bootloader subprocess
 * holding the unpacked interpreter; without /T the bootloader survives and
 * the next launch can fail to bind the worker's healthPort.
 */
function forceKillTree(pid: number): void {
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/F', '/T', '/PID', String(pid)], {
        windowsHide: true,
        timeout: 5000
      })
    } else {
      process.kill(pid, 'SIGKILL')
    }
  } catch {
    /* PID already gone, taskkill missing, or permission denied — accept
       that we may leak a stale process; better than throwing in shutdown. */
  }
}

/**
 * Wait for a child to exit, escalating to SIGKILL/taskkill on timeout.
 * Returns when the child has exited or the force-kill timeout has elapsed
 * (whichever comes first). Used by restartWorker AND by stopAllWorkersAsync
 * so we never spawn a replacement while the previous instance still holds
 * the worker port, and we never declare shutdown done while a Python
 * worker is still mid-flush.
 *
 * Listener registration order: 'exit' is registered BEFORE the synchronous
 * exitCode re-check inside the Promise executor, closing the narrow race
 * where the child exits between function entry and listener register.
 */
async function killWithEscalation(
  handle: WorkerHandle,
  graceMs = 2000,
  forceMs = 1500
): Promise<void> {
  const child = handle.child
  if (!child || child.killed || child.exitCode !== null) return

  const exited = new Promise<void>((resolve) => {
    // Register the listener FIRST. Even if the child has already exited
    // by the time the executor runs, the synchronous exitCode check below
    // catches that case and resolves immediately. The listener is a no-op
    // in that branch (Node's once() ignores subsequent emits after the
    // child has already exited, but it also just won't fire — either way
    // we've resolved via the sync path).
    child.once('exit', () => resolve())
    if (child.exitCode !== null) {
      resolve()
    }
  })

  try {
    child.kill()
  } catch {
    /* already dead */
  }

  const gracefullyExited = await Promise.race([
    exited.then(() => true),
    new Promise<boolean>((r) => setTimeout(() => r(false), graceMs))
  ])
  if (gracefullyExited) return

  pushLog(handle, `[supervisor] ${handle.config.name} did not exit on SIGTERM; force-killing tree`)
  if (child.pid) forceKillTree(child.pid)

  await Promise.race([
    exited,
    new Promise<void>((r) => setTimeout(r, forceMs))
  ])
}

/**
 * Asynchronous shutdown that gives every worker a chance to exit gracefully
 * via SIGTERM before escalating to taskkill /F /T. Run from the
 * before-quit handler with event.preventDefault() + app.quit() once we
 * resolve, so Electron actually waits for graceful shutdown.
 *
 * The previous fully-synchronous shape (SIGTERM all, then immediately
 * taskkill the survivors) didn't work as documented — pass 2's
 * `child.exitCode === null` check fires before Node's event loop has had
 * any chance to emit the 'exit' event, so survivors === everyone, so
 * every shutdown was a hard taskkill. That defeated the FastAPI wrapper's
 * shutdown handlers (log flush, DB cursor close).
 */
export async function stopAllWorkersAsync(): Promise<void> {
  // Set the shutdown flag BEFORE killing children. The exit handler's
  // setTimeout-restart path checks this flag and bails out, so a worker that
  // crashes 1-5 ms before stopAllWorkers runs doesn't get auto-respawned
  // after the supervisor has "stopped".
  isShuttingDown = true
  if (healthInterval) {
    clearInterval(healthInterval)
    healthInterval = null
  }
  // killWithEscalation does the SIGTERM → wait grace → taskkill sequence
  // per worker. Run them in parallel — three workers shutting down
  // independently is faster than serially, and the 2-second grace window
  // is shared across the whole shutdown rather than multiplied.
  await Promise.all(
    Array.from(handles.values()).map(async (handle) => {
      if (handle.child && !handle.child.killed) {
        await killWithEscalation(handle)
      }
      handle.status = 'stopped'
    })
  )
}

/**
 * Synchronous fallback for callers that can't await (none today, but kept
 * for future compatibility). Loses the graceful-exit window — equivalent
 * to "kill all, immediately force-kill survivors that haven't run their
 * exit listeners yet."
 *
 * @deprecated Use stopAllWorkersAsync from before-quit with
 * event.preventDefault() + app.quit() once it resolves.
 */
export function stopAllWorkers(): void {
  isShuttingDown = true
  if (healthInterval) {
    clearInterval(healthInterval)
    healthInterval = null
  }
  for (const handle of handles.values()) {
    if (handle.child && !handle.child.killed) {
      try {
        handle.child.kill()
      } catch {
        /* dead process: ignore */
      }
      const pid = handle.child.pid
      if (pid) forceKillTree(pid)
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
      lastHealthCheckOk: handle.lastHealthCheckOk,
      exitCode: handle.exitCode,
      restartCount: handle.restartCount
    })
  }
  return out
}

export async function restartWorker(name: string): Promise<void> {
  const handle = handles.get(name)
  if (!handle) return
  // Honour the shutdown flag — restartWorker is reachable from the IPC
  // handler the Diagnostics panel wires; the user could click "Restart"
  // and immediately quit. Without this guard, the spawnWorker() at the
  // end of this function would start a fresh process AFTER stopAllWorkers
  // has run, leaving the orphan we documented in CLAUDE.md item 18.
  if (isShuttingDown) return
  if (handle.child && !handle.child.killed) {
    // Tell the exit handler to skip its auto-respawn — otherwise we end up
    // with two processes (one from the exit-handler setTimeout, one from
    // spawnWorker below) fighting for the worker's port.
    handle.manualRestartInProgress = true
    // killWithEscalation waits for actual exit (or force-kills the tree on
    // 2 s timeout) before returning, so spawnWorker below never races a
    // still-alive previous instance for the worker's healthPort.
    await killWithEscalation(handle)
  }
  if (isShuttingDown) return
  handle.restartCount = 0
  spawnWorker(handle)
}

export async function tailWorkerLog(name: string, lines: number): Promise<string> {
  const handle = handles.get(name)
  if (!handle) return `(no worker named ${name})`
  const n = Math.max(1, Math.min(LOG_RING, lines))
  return handle.logBuffer.slice(-n).join('\n')
}
