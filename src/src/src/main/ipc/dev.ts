import { ipcMain, BrowserWindow, app, shell } from 'electron'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { statSync, existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { IpcChannel } from '@shared/ipc-channels'
import type {
  DevPaths,
  DevRunStorybookResult,
  DevSqlResult,
  DevStorybookInfo,
  DevStorybookLog,
  DevStorybookScreenshot
} from '@shared/types'
import { getLocAdmDb } from '../db/connection'
import { resolveWorkersDir } from '../workers/config'

const MAX_SQL_ROWS = 500
const BANNED_SQL_KEYWORDS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'ALTER',
  'CREATE',
  'ATTACH',
  'DETACH',
  'VACUUM',
  'REINDEX',
  'REPLACE',
  'TRIGGER'
]

function projectRootDir(): string | null {
  // __dirname in dev: <repo>/src/src/out/main → project root is ../../
  // Packaged: __dirname is inside resources/app.asar — there is no meaningful
  // "project root" in a packaged install; storybook is a source-tree artifact.
  if (app.isPackaged) return null
  return resolve(__dirname, '../..')
}

function validateSelectSql(sql: string): { ok: boolean; error?: string; query?: string } {
  const trimmed = sql.trim().replace(/;+\s*$/, '')
  if (!trimmed) return { ok: false, error: 'query is empty' }
  if (trimmed.includes(';')) {
    return { ok: false, error: 'only single statements are allowed' }
  }
  for (const kw of BANNED_SQL_KEYWORDS) {
    if (new RegExp(`\\b${kw}\\b`, 'i').test(trimmed)) {
      return {
        ok: false,
        error: `keyword ${kw} is not allowed — SELECT / WITH / PRAGMA / EXPLAIN only`
      }
    }
  }
  if (!/^\s*(SELECT|WITH|PRAGMA|EXPLAIN)\b/i.test(trimmed)) {
    return {
      ok: false,
      error: 'query must begin with SELECT, WITH, PRAGMA, or EXPLAIN'
    }
  }
  if (/^\s*PRAGMA\b/i.test(trimmed) && /=/.test(trimmed)) {
    return { ok: false, error: 'PRAGMA writes (with `=`) are not allowed' }
  }
  return { ok: true, query: trimmed }
}

function countScreenshots(dir: string): number {
  try {
    if (!existsSync(dir)) return 0
    return readdirSync(dir).filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
      .length
  } catch {
    return 0
  }
}

export function registerDevHandlers(): void {
  ipcMain.handle(IpcChannel.DevOpenDevTools, () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    win?.webContents.openDevTools({ mode: 'detach' })
  })

  ipcMain.handle(IpcChannel.DevCloseDevTools, () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    win?.webContents.closeDevTools()
  })

  ipcMain.handle(IpcChannel.DevReload, () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    win?.webContents.reloadIgnoringCache()
  })

  ipcMain.handle(IpcChannel.DevHardReset, () => {
    app.relaunch()
    app.exit(0)
  })

  ipcMain.handle(IpcChannel.DevGetPaths, (): DevPaths => {
    const locAdm = getLocAdmDb()
    const workers = resolveWorkersDir()
    const workersExists = existsSync(workers)
    return {
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      chromeVersion: process.versions.chrome,
      platform: `${process.platform} ${process.arch}`,
      userData: app.getPath('userData'),
      resources: process.resourcesPath,
      locAdmDb: locAdm.name,
      workersDir: workersExists ? workers : null,
      projectRoot: projectRootDir(),
      isPackaged: app.isPackaged
    }
  })

  ipcMain.handle(
    IpcChannel.DevSqlSelect,
    async (_evt, sql: string): Promise<DevSqlResult> => {
      const validation = validateSelectSql(sql)
      if (!validation.ok) {
        return {
          ok: false,
          error: validation.error,
          columns: [],
          rows: [],
          truncated: false,
          rowCount: 0,
          durationMs: 0
        }
      }
      const db = getLocAdmDb()
      const started = performance.now()
      try {
        const stmt = db.prepare(validation.query!)
        const allRows = stmt.all() as Record<string, unknown>[]
        let columns: string[] = []
        try {
          columns = stmt.columns().map((c) => c.name)
        } catch {
          columns = allRows[0] ? Object.keys(allRows[0]) : []
        }
        const truncated = allRows.length > MAX_SQL_ROWS
        const sliced = truncated ? allRows.slice(0, MAX_SQL_ROWS) : allRows
        const rows: unknown[][] = sliced.map((r) =>
          columns.length > 0 ? columns.map((c) => r[c]) : Object.values(r)
        )
        return {
          ok: true,
          columns,
          rows,
          truncated,
          rowCount: allRows.length,
          durationMs: Math.round(performance.now() - started)
        }
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          columns: [],
          rows: [],
          truncated: false,
          rowCount: 0,
          durationMs: Math.round(performance.now() - started)
        }
      }
    }
  )

  ipcMain.handle(IpcChannel.DevGetStorybookInfo, (): DevStorybookInfo => {
    const root = projectRootDir()
    if (!root) {
      // Packaged build — no source tree, no storybook to report on.
      return {
        available: false,
        mtime: null,
        screenshotCount: 0,
        unpackedExists: false,
        unpackedPath: '',
        storybookDir: ''
      }
    }
    const storybookDir = join(root, 'storybook')
    const screenshotsDir = join(storybookDir, 'screenshots')
    const mdPath = join(storybookDir, 'STORYBOOK.md')
    let mtime: number | null = null
    try {
      if (existsSync(mdPath)) mtime = statSync(mdPath).mtimeMs
    } catch {
      mtime = null
    }
    const unpackedPath = join(root, 'release-builds', 'win-unpacked', 'ShortCut Studio.exe')
    return {
      available: true,
      mtime,
      screenshotCount: countScreenshots(screenshotsDir),
      unpackedExists: existsSync(unpackedPath),
      unpackedPath,
      storybookDir
    }
  })

  ipcMain.handle(
    IpcChannel.DevListStorybookScreenshots,
    async (): Promise<DevStorybookScreenshot[]> => {
      const root = projectRootDir()
      if (!root) return []
      const dir = join(root, 'storybook', 'screenshots')
      if (!existsSync(dir)) return []
      const files = readdirSync(dir)
        .filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
        .sort()
      const out: DevStorybookScreenshot[] = []
      for (const name of files) {
        const full = join(dir, name)
        try {
          const buf = await readFile(full)
          const ext = name.toLowerCase().endsWith('.jpg') || name.toLowerCase().endsWith('.jpeg')
            ? 'jpeg'
            : name.toLowerCase().endsWith('.webp')
              ? 'webp'
              : 'png'
          out.push({
            name,
            route: '/' + name.replace(/\.(png|jpg|jpeg|webp)$/i, ''),
            dataUrl: `data:image/${ext};base64,${buf.toString('base64')}`,
            sizeBytes: buf.byteLength
          })
        } catch {
          // skip unreadable files
        }
      }
      return out
    }
  )

  ipcMain.handle(IpcChannel.DevOpenStorybookFolder, async () => {
    const root = projectRootDir()
    if (!root) {
      // Packaged build: no source tree. Open the resources folder instead so
      // the user sees a real Explorer window (not the app-chooser dialog that
      // appears when shell.openPath is pointed at app.asar).
      await shell.openPath(process.resourcesPath)
      return
    }
    const storybookDir = join(root, 'storybook')
    if (existsSync(storybookDir)) {
      await shell.openPath(storybookDir)
    } else {
      await shell.openPath(root)
    }
  })

  ipcMain.handle(IpcChannel.DevRunStorybook, async (): Promise<DevRunStorybookResult> => {
    if (app.isPackaged) {
      return {
        ok: false,
        exitCode: null,
        error: 'storybook regeneration is only available in dev builds (no npm in packaged installer)'
      }
    }
    const focused =
      BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const send = (payload: DevStorybookLog): void => {
      focused?.webContents.send(IpcChannel.DevStorybookLog, payload)
    }
    const cwd = projectRootDir()
    if (!cwd) {
      return {
        ok: false,
        exitCode: null,
        error: 'storybook regeneration requires a source tree (not available in packaged builds)'
      }
    }
    send({
      stream: 'system',
      line: `$ npm run storybook  (cwd=${cwd})`,
      ts: Date.now()
    })
    return await new Promise<DevRunStorybookResult>((resolveResult) => {
      const child = spawn('npm', ['run', 'storybook'], {
        cwd,
        shell: true,
        windowsHide: true
      })
      child.stdout?.on('data', (chunk: Buffer) => {
        for (const line of chunk.toString().split(/\r?\n/)) {
          if (line.trim()) send({ stream: 'stdout', line, ts: Date.now() })
        }
      })
      child.stderr?.on('data', (chunk: Buffer) => {
        for (const line of chunk.toString().split(/\r?\n/)) {
          if (line.trim()) send({ stream: 'stderr', line, ts: Date.now() })
        }
      })
      child.on('error', (err) => {
        send({
          stream: 'system',
          line: `[error] ${err.message}`,
          ts: Date.now()
        })
        resolveResult({ ok: false, exitCode: null, error: err.message })
      })
      child.on('exit', (code) => {
        send({
          stream: 'system',
          line: `[exit] code=${code}`,
          ts: Date.now()
        })
        resolveResult({ ok: code === 0, exitCode: code })
      })
    })
  })
}
