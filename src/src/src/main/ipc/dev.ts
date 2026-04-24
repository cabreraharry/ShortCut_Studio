import { ipcMain, BrowserWindow, app, shell } from 'electron'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
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

// Routes the storybook captures. Matches the CLI script at scripts/storybook.ts
// but uses current app route names (e.g. /topic-map, not /knowledge-map).
const STORYBOOK_ROUTES = [
  '/dashboard',
  '/folders',
  '/topics',
  '/insights',
  '/topic-map',
  '/community',
  '/filters',
  '/privacy',
  '/llm',
  '/settings'
] as const

const SCREENSHOT_WIDTH = 1920
const SCREENSHOT_HEIGHT = 1080
const SCREENSHOT_SETTLE_MS = 1200

/**
 * Where storybook output lives for this environment.
 *   Dev: <projectRoot>/storybook/
 *   Packaged: <userData>/storybook/
 */
function storybookOutputDir(): string {
  const root = projectRootDir()
  if (root) return join(root, 'storybook')
  return join(app.getPath('userData'), 'storybook')
}

function slugifyRoute(route: string): string {
  return route.replace(/^\//, '').replace(/\//g, '-') || 'root'
}

function renderStorybookMarkdown(routes: readonly string[]): string {
  const when = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const lines: string[] = [
    '# ShortCut Studio — Storybook',
    '',
    `Regenerated ${when} from inside the running app (Electron capturePage).`,
    '',
    '## Routes captured',
    ''
  ]
  for (const route of routes) {
    const slug = slugifyRoute(route)
    lines.push(`### ${route}`, '', `![${slug}](screenshots/${slug}.png)`, '')
  }
  return lines.join('\n')
}

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
    const dir = storybookOutputDir()
    const mdPath = join(dir, 'STORYBOOK.md')
    let mtime: number | null = null
    try {
      if (existsSync(mdPath)) mtime = statSync(mdPath).mtimeMs
    } catch {
      mtime = null
    }
    return {
      // capturePage-based regeneration works everywhere now; no longer
      // gated on having a source tree.
      available: true,
      mtime,
      screenshotCount: countScreenshots(join(dir, 'screenshots')),
      unpackedExists: false,
      unpackedPath: '',
      storybookDir: dir
    }
  })

  ipcMain.handle(
    IpcChannel.DevListStorybookScreenshots,
    async (): Promise<DevStorybookScreenshot[]> => {
      const dir = join(storybookOutputDir(), 'screenshots')
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
    const dir = storybookOutputDir()
    if (!existsSync(dir)) {
      // Create it on demand so the button never silently does nothing —
      // first-time users see an empty folder they can watch fill up.
      await mkdir(dir, { recursive: true })
    }
    await shell.openPath(dir)
  })

  ipcMain.handle(
    IpcChannel.DevCaptureStorybook,
    async (): Promise<DevRunStorybookResult> => {
      const source =
        BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (!source) {
        return {
          ok: false,
          exitCode: null,
          error: 'no source window to capture from'
        }
      }

      const send = (line: string, stream: DevStorybookLog['stream'] = 'system'): void => {
        source.webContents.send(IpcChannel.DevStorybookLog, {
          stream,
          line,
          ts: Date.now()
        })
      }

      // Derive base URL from the live source window — works for both dev
      // (http://localhost:5173/) and packaged (file:///.../index.html).
      const sourceUrl = source.webContents.getURL()
      const baseUrl = sourceUrl.split('#')[0].replace(/\?.*$/, '')

      const outDir = storybookOutputDir()
      const shotsDir = join(outDir, 'screenshots')
      await mkdir(shotsDir, { recursive: true })

      send(`output: ${outDir}`)
      send(`base URL: ${baseUrl}`)

      // Hidden window mirrors the main window's webPreferences so the
      // renderer boots normally (preload wired, context isolation on).
      const captureWindow = new BrowserWindow({
        show: false,
        width: SCREENSHOT_WIDTH,
        height: SCREENSHOT_HEIGHT,
        webPreferences: {
          preload: join(__dirname, '../preload/index.js'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false,
          backgroundThrottling: false
        }
      })
      // Windows compositors sometimes skip rendering show:false windows.
      // Position way off-screen and show() so frames actually render.
      captureWindow.setPosition(-20000, -20000)
      captureWindow.show()

      let errorCount = 0
      try {
        for (const route of STORYBOOK_ROUTES) {
          try {
            const url = `${baseUrl}?screenshot=1#${route}`
            send(`capturing ${route} …`)
            await captureWindow.loadURL(url)
            await new Promise<void>((r) => setTimeout(r, SCREENSHOT_SETTLE_MS))
            const img = await captureWindow.webContents.capturePage()
            const png = img.toPNG()
            const outPath = join(shotsDir, `${slugifyRoute(route)}.png`)
            await writeFile(outPath, png)
            send(`  wrote ${png.byteLength.toLocaleString()} bytes`)
          } catch (err) {
            errorCount += 1
            const msg = err instanceof Error ? err.message : String(err)
            send(`  error on ${route}: ${msg}`, 'stderr')
          }
        }
        const mdPath = join(outDir, 'STORYBOOK.md')
        await writeFile(mdPath, renderStorybookMarkdown(STORYBOOK_ROUTES))
        send(`wrote ${mdPath}`)

        if (errorCount > 0) {
          send(`done with ${errorCount} error(s)`, 'stderr')
          return {
            ok: false,
            exitCode: errorCount,
            error: `${errorCount} route(s) failed`
          }
        }
        send('done')
        return { ok: true, exitCode: 0 }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        send(`fatal: ${msg}`, 'stderr')
        return { ok: false, exitCode: null, error: msg }
      } finally {
        captureWindow.destroy()
      }
    }
  )
}
