import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import { getLocAdmDb } from '../db/connection'
import { getFolderHealthReal } from '../db/scl-folder'
import { recordError } from '../diagnostics/errorStore'
import { notify } from '../notifications/dispatch'
import { resolveWorkersDir } from './config'
import type { DbMode } from '@shared/types'

/**
 * On-demand `filescanner.exe` runner. Triggered when the user adds a folder
 * via the Folders page (see ipc/folders.ts::FoldersAdd). Fire-and-forget:
 * the IPC handler returns immediately, the scan runs in the background,
 * progress is tracked via an OCR_Process row + the existing dashboard poll
 * cycle, and a notification fires on completion.
 *
 * Distinct from the supervisor in workers/supervisor.ts: that file manages
 * long-running workers (root_watchdog / topic_watchdog / gemini_processor)
 * with health pings + auto-restart. Filescanner is one-shot — it walks the
 * folder, writes Files rows, exits. No /health endpoint, no auto-restart on
 * crash. A failed scan stays failed until the user re-adds (or a future
 * "Scan now" button).
 */

const FILESCANNER_EXE = 'filescanner.exe'
const LOG_RING_LINES = 200

interface ScanHandle {
  child: ChildProcess
  jobId: number
  startedAt: number
  logBuffer: string[]
}

const inflight = new Map<string, ScanHandle>()

function inflightKey(mode: DbMode, targetFolder: string): string {
  return `${mode}::${targetFolder.toLowerCase()}`
}

function resolveFilescannerPath(): string | null {
  const path = join(resolveWorkersDir(), FILESCANNER_EXE)
  return existsSync(path) ? path : null
}

function pushLog(handle: ScanHandle, line: string): void {
  handle.logBuffer.push(line)
  if (handle.logBuffer.length > LOG_RING_LINES) {
    handle.logBuffer.splice(0, handle.logBuffer.length - LOG_RING_LINES)
  }
}

function tailLog(handle: ScanHandle, n: number): string {
  return handle.logBuffer.slice(-n).join('\n')
}

export interface ScanRequest {
  targetFolder: string
  mode: DbMode
}

/**
 * Queue a scan for the given folder. No-op if a scan for the same
 * (mode, folder) is already in flight. Returns the OCR_Process job id
 * (or null if the queue was rejected — exe missing, duplicate scan).
 */
export function enqueueScan(req: ScanRequest): number | null {
  const key = inflightKey(req.mode, req.targetFolder)
  if (inflight.has(key)) {
    return null
  }

  const exe = resolveFilescannerPath()
  if (!exe) {
    const message = `filescanner.exe not found in ${resolveWorkersDir()}`
    recordError({
      source: 'main',
      severity: 'error',
      category: 'scan-runner',
      message,
      context: { targetFolder: req.targetFolder, mode: req.mode }
    })
    notify({
      severity: 'error',
      source: 'main',
      title: 'Cannot start scan',
      body: 'filescanner.exe is missing. Reinstall ShortCut Studio or check the SCL_Demo build.',
      action: { kind: 'navigate', target: '/settings#diagnostics' }
    })
    return null
  }

  const db = getLocAdmDb()
  const startedAt = Math.floor(Date.now() / 1000)
  const insert = db
    .prepare(
      `INSERT INTO OCR_Process (Kind, Status, Label, StartedAt, ProgressCurrent, ProgressTotal)
       VALUES ('scan', 'running', ?, ?, 0, 0)`
    )
    .run(basename(req.targetFolder), startedAt)
  const jobId = Number(insert.lastInsertRowid)

  // In-app entry only for "started" — the user just clicked "Add folder," they
  // know what they did. Popping a Windows toast for it would be self-noise.
  notify({
    severity: 'info',
    source: 'main',
    title: `Scanning ${basename(req.targetFolder)}`,
    body: req.targetFolder,
    osToast: false
  })

  const args = [
    '--target-folder',
    req.targetFolder,
    '--mode',
    'scan',
    '--db-mode',
    req.mode,
    '--root-id',
    '0',
    '--do-details'
  ]

  let child: ChildProcess
  try {
    child = spawn(exe, args, {
      cwd: resolveWorkersDir(),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: { ...process.env }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    finalizeError(jobId, req, message)
    return jobId
  }

  const handle: ScanHandle = {
    child,
    jobId,
    startedAt,
    logBuffer: []
  }
  inflight.set(key, handle)

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

  child.on('error', (err) => {
    inflight.delete(key)
    finalizeError(jobId, req, err.message ?? String(err), tailLog(handle, 20))
  })

  child.on('exit', (code) => {
    inflight.delete(key)
    if (code === 0) {
      finalizeSuccess(jobId, req)
    } else {
      finalizeError(
        jobId,
        req,
        `filescanner exited with code ${code ?? 'null'}`,
        tailLog(handle, 20)
      )
    }
  })

  return jobId
}

function finalizeSuccess(jobId: number, req: ScanRequest): void {
  // Count what we produced. Uses the existing folder-health helper which
  // already does path-prefix matching against the active SCLFolder DB.
  // If the user flipped mode mid-scan, this returns whatever the new mode
  // shows — accepted for v1; mode-mismatch handling is a future refinement.
  let fileCount = 0
  try {
    const health = getFolderHealthReal(req.targetFolder)
    fileCount = health.fileCount
  } catch {
    // SCLFolder DB unreachable — leave 0; user can refresh later.
  }

  try {
    getLocAdmDb()
      .prepare(
        `UPDATE OCR_Process
         SET Status = 'completed',
             FinishedAt = ?,
             ProgressCurrent = ?,
             ProgressTotal = ?,
             Error = NULL
         WHERE JobID = ?`
      )
      .run(Math.floor(Date.now() / 1000), fileCount, fileCount, jobId)
  } catch {
    /* swallow — DB row is best-effort book-keeping */
  }

  notify({
    severity: 'info',
    source: 'main',
    title: `Scan complete — ${basename(req.targetFolder)}`,
    body:
      fileCount > 0
        ? `${fileCount} document${fileCount === 1 ? '' : 's'} indexed. Topic generation will continue in the background.`
        : 'No documents found in this folder.',
    action: { kind: 'navigate', target: '/insights' }
  })
}

function finalizeError(
  jobId: number,
  req: ScanRequest,
  message: string,
  stderrTail?: string
): void {
  try {
    getLocAdmDb()
      .prepare(
        `UPDATE OCR_Process
         SET Status = 'error',
             FinishedAt = ?,
             Error = ?
         WHERE JobID = ?`
      )
      .run(
        Math.floor(Date.now() / 1000),
        stderrTail ? `${message}\n---\n${stderrTail}` : message,
        jobId
      )
  } catch {
    /* swallow */
  }

  recordError({
    source: 'main',
    severity: 'error',
    category: 'scan-runner',
    message,
    context: {
      targetFolder: req.targetFolder,
      mode: req.mode,
      stderrTail: stderrTail ?? null
    }
  })

  notify({
    severity: 'error',
    source: 'main',
    title: `Scan failed — ${basename(req.targetFolder)}`,
    body: message,
    action: { kind: 'navigate', target: '/settings#diagnostics' }
  })
}

/**
 * Best-effort cancellation hook. Used by the app shutdown sequence so we
 * don't leave orphaned filescanner processes after the parent exits.
 * NOT wired to FoldersRemove — see plan §"Out of scope" for rationale.
 */
export function cancelAllScans(): void {
  for (const [, handle] of inflight) {
    try {
      handle.child.kill()
    } catch {
      /* swallow */
    }
  }
  inflight.clear()
}
