import { spawn } from 'node:child_process'
import {
  cpSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import { app, net, shell } from 'electron'
import { getComponent, type ComponentId } from '@shared/components-manifest'

// Runtime install for optional components, mirroring scripts/fetch-vendor-
// binaries.mjs but at app-runtime instead of build-time. This is the codepath
// the Settings -> Components panel hits when a user clicks "Install" on a
// bundled component that was opted out at install time.
//
// Bundled installs land at process.resourcesPath/extras/<id>/ to match the
// shape produced by the installer (so the detector probe finds them).
//
// External components just shell-open the download page — the third-party
// installer takes over from there.

interface VendorSpec {
  name: string
  version: string
  url: string
  expectedSize: number
  zipSubdir: string
  sentinelFile: string
}

// Mirror of the IPFS + NGINX constants in scripts/fetch-vendor-binaries.mjs.
// Keep these in lockstep when bumping versions on either side.
const VENDOR_SPECS: Record<'ipfs' | 'nginx', VendorSpec> = {
  ipfs: {
    name: 'IPFS Kubo',
    version: 'v0.41.0',
    url: 'https://dist.ipfs.tech/kubo/v0.41.0/kubo_v0.41.0_windows-amd64.zip',
    expectedSize: 40978647,
    zipSubdir: 'kubo',
    sentinelFile: 'ipfs.exe'
  },
  nginx: {
    name: 'Nginx',
    version: '1.26.2',
    url: 'https://nginx.org/download/nginx-1.26.2.zip',
    expectedSize: 2081815,
    zipSubdir: 'nginx-1.26.2',
    sentinelFile: 'nginx.exe'
  }
}

function cacheRoot(): string {
  return join(app.getPath('userData'), 'extras-cache')
}

function targetDirFor(subpath: string): string {
  return join(process.resourcesPath, subpath)
}

function downloadToFile(url: string, dest: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const stream = createWriteStream(dest)
    const req = net.request({ method: 'GET', url })
    let total = 0
    req.on('response', (res) => {
      if ((res.statusCode ?? 0) >= 400) {
        stream.destroy()
        reject(new Error(`HTTP ${res.statusCode} from ${url}`))
        return
      }
      res.on('data', (chunk: Buffer) => {
        total += chunk.length
        stream.write(chunk)
      })
      res.on('end', () => {
        stream.end()
        stream.on('close', () => resolve(total))
      })
      res.on('error', (err) => {
        stream.destroy()
        reject(err)
      })
    })
    req.on('error', (err) => {
      stream.destroy()
      reject(err)
    })
    req.end()
  })
}

// PowerShell single-quote literal: ' is the only escape, doubled. Windows
// paths can contain ' in usernames (e.g. C:\Users\O'Brien\AppData\...), and
// without escaping that breaks the -Command string and risks injection.
function psQuote(p: string): string {
  return `'${p.replace(/'/g, "''")}'`
}

function extractZip(zipPath: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    rmSync(destDir, { recursive: true, force: true })
    mkdirSync(destDir, { recursive: true })
    // Same approach as scripts/fetch-vendor-binaries.mjs: rely on PowerShell's
    // built-in Expand-Archive instead of pulling in a runtime zip dep.
    const child = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        `Expand-Archive -LiteralPath ${psQuote(zipPath)} -DestinationPath ${psQuote(destDir)} -Force`
      ],
      { windowsHide: true }
    )
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Expand-Archive exited ${code}`))
    })
    child.on('error', reject)
  })
}

function flattenStaging(stagingDir: string, zipSubdir: string, outDir: string): void {
  const innerDir = join(stagingDir, zipSubdir)
  if (!existsSync(innerDir)) {
    throw new Error(
      `Expected ${innerDir} after extraction; got: ${readdirSync(stagingDir).join(', ')}`
    )
  }
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })
  for (const entry of readdirSync(innerDir)) {
    cpSync(join(innerDir, entry), join(outDir, entry), { recursive: true })
  }
}

async function installBundled(id: ComponentId): Promise<void> {
  // In dev, process.resourcesPath points at Electron's own resources tree.
  // Writing into it would pollute the Electron install. The packaged-only
  // guard mirrors what detector.ts does in bundledExtraDir().
  if (!app.isPackaged) {
    throw new Error('Bundled-component install only available in packaged builds')
  }
  const component = getComponent(id)
  if (!component || component.category !== 'bundled' || !component.vendorFetchKey) {
    throw new Error(`Component ${id} is not a bundled component`)
  }
  if (!component.resourceSubpath || !component.sentinelFile) {
    throw new Error(`Component ${id} missing resourceSubpath/sentinelFile`)
  }
  const spec = VENDOR_SPECS[component.vendorFetchKey]
  const cache = cacheRoot()
  mkdirSync(cache, { recursive: true })
  const zipName = spec.url.split('/').pop() ?? `${id}.zip`
  const zipPath = join(cache, zipName)
  let needDownload = true
  if (existsSync(zipPath)) {
    const sz = statSync(zipPath).size
    if (sz === spec.expectedSize) needDownload = false
  }
  if (needDownload) {
    const got = await downloadToFile(spec.url, zipPath)
    if (got !== spec.expectedSize) {
      // Don't hard-fail on size mismatch — upstream sometimes serves slightly
      // different bytes (mirror lag, recompression). Sentinel-file existence
      // after extract is the real correctness check.
      console.warn(`[components] ${spec.name}: downloaded ${got} bytes, expected ${spec.expectedSize}`)
    }
  }
  const stagingDir = join(cache, `${spec.zipSubdir}-staging`)
  await extractZip(zipPath, stagingDir)
  const outDir = targetDirFor(component.resourceSubpath)
  flattenStaging(stagingDir, spec.zipSubdir, outDir)
  rmSync(stagingDir, { recursive: true, force: true })
  writeFileSync(join(outDir, 'VERSION'), spec.version + '\n')
  const sentinel = join(outDir, component.sentinelFile)
  if (!existsSync(sentinel)) {
    throw new Error(`Install completed but sentinel ${sentinel} missing`)
  }
}

export async function installComponent(id: ComponentId): Promise<void> {
  const component = getComponent(id)
  if (!component) throw new Error(`Unknown component ${id}`)
  if (component.category === 'external') {
    if (!component.externalUrl) {
      throw new Error(`Component ${id} has no externalUrl`)
    }
    await shell.openExternal(component.externalUrl)
    return
  }
  await installBundled(id)
}
