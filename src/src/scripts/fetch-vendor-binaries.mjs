#!/usr/bin/env node
/**
 * Fetch + extract IPFS Kubo and Nginx binaries into vendor/ for the installer
 * to bundle. Idempotent: skips re-download/extract if the target binary
 * already exists at the expected path.
 *
 * Layout produced:
 *   vendor/
 *     ipfs/
 *       ipfs.exe        ← from kubo zip's `kubo/ipfs.exe`
 *       LICENSE-MIT
 *       LICENSE-APACHE
 *       README.md
 *       VERSION         ← we write this, contains the version string
 *     nginx/
 *       nginx.exe       ← from nginx zip's `nginx-1.26.2/nginx.exe`
 *       conf/
 *       html/
 *       VERSION
 *
 * Run via `npm run fetch-vendor` (which is wired as a prebuild step for
 * build:win). Re-run after bumping versions.
 */

import { spawnSync } from 'node:child_process'
import {
  cpSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const vendorDir = join(repoRoot, 'vendor')
const cacheDir = join(vendorDir, '.cache')

const IPFS = {
  name: 'IPFS Kubo',
  version: 'v0.41.0',
  url: 'https://dist.ipfs.tech/kubo/v0.41.0/kubo_v0.41.0_windows-amd64.zip',
  // Verified via curl HEAD on 2026-04-29: 40978647 bytes.
  expectedSize: 40978647,
  zipSubdir: 'kubo',
  outDir: join(vendorDir, 'ipfs'),
  sentinelFile: 'ipfs.exe'
}

const NGINX = {
  name: 'Nginx',
  version: '1.26.2',
  url: 'https://nginx.org/download/nginx-1.26.2.zip',
  expectedSize: 2081815,
  zipSubdir: 'nginx-1.26.2',
  outDir: join(vendorDir, 'nginx'),
  sentinelFile: 'nginx.exe'
}

function log(msg) {
  console.log(`[fetch-vendor] ${msg}`)
}

function alreadyExtracted(spec) {
  const sentinel = join(spec.outDir, spec.sentinelFile)
  if (!existsSync(sentinel)) return false
  const versionFile = join(spec.outDir, 'VERSION')
  if (!existsSync(versionFile)) return false
  // If the user has bumped the version constant in this file but vendor/
  // still holds the old one, force re-extract. Read the on-disk file and
  // compare exactly.
  const onDisk = readVersion(versionFile)
  return onDisk === spec.version
}

function readVersion(path) {
  try {
    return readFileSync(path, 'utf8').trim()
  } catch {
    return ''
  }
}

async function downloadIfNeeded(spec, dest) {
  if (existsSync(dest)) {
    const stat = statSync(dest)
    if (stat.size === spec.expectedSize) {
      log(`${spec.name}: cache hit (${dest})`)
      return
    }
    log(`${spec.name}: cached size mismatch (${stat.size} vs ${spec.expectedSize}), re-downloading`)
    rmSync(dest)
  }
  log(`${spec.name}: downloading ${spec.url}`)
  // Use Node's built-in fetch (Node 18+). Streams to disk so we don't blow
  // through memory for the ~40 MB IPFS zip.
  const res = await fetch(spec.url)
  if (!res.ok) {
    throw new Error(`${spec.name}: HTTP ${res.status} from ${spec.url}`)
  }
  const stream = createWriteStream(dest)
  const reader = res.body.getReader()
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    stream.write(value)
    total += value.length
  }
  stream.end()
  await new Promise((r) => stream.on('close', r))
  if (total !== spec.expectedSize) {
    log(`${spec.name}: WARNING: downloaded size ${total} differs from expected ${spec.expectedSize}`)
  } else {
    log(`${spec.name}: downloaded ${total} bytes`)
  }
}

function extractZip(zipPath, destDir) {
  // Windows 10+ ships PowerShell 5.1+ with Expand-Archive. We avoid pulling
  // in a zip-handling npm dep just for the build step. -Force overwrites.
  rmSync(destDir, { recursive: true, force: true })
  mkdirSync(destDir, { recursive: true })
  const result = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      `Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force`
    ],
    { stdio: 'inherit' }
  )
  if (result.status !== 0) {
    throw new Error(`Expand-Archive failed for ${zipPath} (exit ${result.status})`)
  }
}

function flattenIntoOutDir(stagingDir, zipSubdir, outDir) {
  // Zip extracts to <stagingDir>/<zipSubdir>/... — flatten one level so
  // outDir contains the binaries directly.
  const innerDir = join(stagingDir, zipSubdir)
  if (!existsSync(innerDir)) {
    throw new Error(`Expected ${innerDir} after extraction; got: ${readdirSync(stagingDir).join(', ')}`)
  }
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })
  for (const entry of readdirSync(innerDir)) {
    cpSync(join(innerDir, entry), join(outDir, entry), { recursive: true })
  }
}

async function processSpec(spec) {
  if (alreadyExtracted(spec)) {
    log(`${spec.name} ${spec.version}: already in place at ${spec.outDir}, skipping`)
    return
  }
  mkdirSync(cacheDir, { recursive: true })
  const zipName = spec.url.split('/').pop()
  const zipPath = join(cacheDir, zipName)
  await downloadIfNeeded(spec, zipPath)
  const stagingDir = join(cacheDir, `${spec.zipSubdir}-staging`)
  extractZip(zipPath, stagingDir)
  flattenIntoOutDir(stagingDir, spec.zipSubdir, spec.outDir)
  rmSync(stagingDir, { recursive: true, force: true })
  writeFileSync(join(spec.outDir, 'VERSION'), spec.version + '\n')
  // Sanity check
  const sentinel = join(spec.outDir, spec.sentinelFile)
  if (!existsSync(sentinel)) {
    throw new Error(`${spec.name}: extraction succeeded but sentinel ${sentinel} not found`)
  }
  log(`${spec.name} ${spec.version}: extracted to ${spec.outDir}`)
}

async function main() {
  log('Starting vendor fetch')
  for (const spec of [IPFS, NGINX]) {
    await processSpec(spec)
  }
  log('Done')
}

main().catch((err) => {
  console.error('[fetch-vendor] FAILED:', err.message)
  process.exit(1)
})
