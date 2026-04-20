import { app } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export interface WorkerConfig {
  name: string
  executable: string          // basename of the .exe
  autoStart: boolean
  args: string[]
  healthPort: number          // FastAPI wrapper port
}

/**
 * Long-running workers that should be auto-started and supervised.
 * One-shot workers (filescanner, rescan, postprocessing) are spawned
 * on demand by their respective IPC handlers — not listed here.
 */
export const SUPERVISED_WORKERS: WorkerConfig[] = [
  {
    name: 'root_watchdog',
    executable: 'root_watchdog.exe',
    autoStart: true,
    args: [],
    healthPort: 19001
  },
  {
    name: 'topic_watchdog',
    executable: 'topic_watchdog.exe',
    autoStart: true,
    args: [],
    healthPort: 19002
  },
  {
    name: 'gemini_processor',
    executable: 'gemini_processor.exe',
    autoStart: true,
    args: ['--incremental'],
    healthPort: 19003
  }
]

/**
 * Resolve the directory that holds the worker .exes. In dev, we look
 * at the sibling SCL_Demo project; in a packaged build, the installer
 * will have copied them into resources/workers/.
 */
export function resolveWorkersDir(): string {
  const override = process.env['SCL_WORKERS_DIR']
  if (override && existsSync(override)) return override

  if (app.isPackaged) {
    const bundled = join(process.resourcesPath, 'workers')
    if (existsSync(bundled)) return bundled
  }

  const sibling = 'D:/Client-Side_Project/SCL_Demo/_exe'
  return sibling
}

export function resolveWorkerExecutable(cfg: WorkerConfig): string | null {
  const dir = resolveWorkersDir()
  const path = join(dir, cfg.executable)
  return existsSync(path) ? path : null
}
