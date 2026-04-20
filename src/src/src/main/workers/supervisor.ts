import type { WorkerStatus } from '@shared/types'

/**
 * Worker supervisor — stub for v1 scaffold.
 *
 * The real implementation spawns SCL_Demo's PyInstaller .exes (filescanner,
 * rescan, watchdogs, gemini_processor, postprocessing), supervises their
 * lifecycle, and queries their FastAPI /health + /status endpoints.
 *
 * Full implementation lands in the worker-supervisor task.
 */
const workers: WorkerStatus[] = [
  { name: 'filescanner', status: 'stopped', restartCount: 0 },
  { name: 'rescan', status: 'stopped', restartCount: 0 },
  { name: 'root_watchdog', status: 'stopped', restartCount: 0 },
  { name: 'topic_watchdog', status: 'stopped', restartCount: 0 },
  { name: 'gemini_processor', status: 'stopped', restartCount: 0 },
  { name: 'postprocessing', status: 'stopped', restartCount: 0 }
]

export function startWorkerSupervisor(): void {
  // Intentionally a no-op for v1 scaffold. Implemented in dedicated task.
}

export function stopAllWorkers(): void {
  // no-op
}

export function getWorkerStatuses(): WorkerStatus[] {
  return workers
}

export async function restartWorker(_name: string): Promise<void> {
  // no-op
}

export async function tailWorkerLog(_name: string, _lines: number): Promise<string> {
  return '(worker supervisor not yet implemented — logs will appear here after the worker-supervisor task)'
}
