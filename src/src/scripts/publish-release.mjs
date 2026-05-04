#!/usr/bin/env node
// publish-release.mjs — one-shot release publisher for ShortCut Studio.
//
// What it does (in order):
//   1. Reads release-builds/<stub.exe> + <app.7z> + <app.7z.blockmap>
//      produced by `npm run build:win`. Errors if missing.
//   2. Computes SHA-256 + size for the stub + payload + blockmap.
//   3. Optionally computes SHA-256 for upstream component zips (IPFS Kubo,
//      Nginx) so the manifest carries real integrity values. Skipped if
//      the cached vendor zips don't exist (manifest gets placeholders).
//   4. Renders a runtime manifest JSON from the components-manifest.ts +
//      package.json version + computed SHAs. Writes to a temp file.
//   5. Uploads the stub + payload + blockmap + manifest to S3 via aws CLI.
//   6. Invalidates CloudFront paths /v1/manifest.json + /releases/<ver>/*.
//
// Required env / config (read from process.env):
//   SCS_RELEASES_BUCKET   Output of `terraform output releases_bucket`
//   SCS_CLOUDFRONT_ID     Output of `terraform output cloudfront_distribution_id`
//   SCS_CHANNEL           'stable' or 'beta' (default 'stable')
//   AWS_PROFILE           AWS CLI profile (optional; uses default chain)
//   SCS_DRY_RUN           If set, prints planned actions but doesn't upload
//
// Usage:
//   cd src/src
//   $env:SCS_RELEASES_BUCKET = 'shortcutstudio-releases-123456789'
//   $env:SCS_CLOUDFRONT_ID   = 'EXXXXXX'
//   npm run publish:release

import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const RELEASE_BUILDS_DIR = join(REPO_ROOT, 'release-builds')
// electron-builder's nsis-web target writes the stub + payload + blockmap
// into the `nsis-web` subdirectory of `directories.output`. The release
// publisher operates on those files, not on the legacy plain-NSIS artifacts
// that may also be present from older builds at the parent level.
const NSIS_WEB_DIR = join(RELEASE_BUILDS_DIR, 'nsis-web')
const VENDOR_CACHE_DIR = join(REPO_ROOT, 'vendor', '.cache')
const FALLBACK_MANIFEST_PATH = join(REPO_ROOT, 'build', 'fallback-manifest.json')
const PACKAGE_JSON_PATH = join(REPO_ROOT, 'package.json')

const DRY_RUN = !!process.env.SCS_DRY_RUN

function fail(msg) {
  console.error(`[publish-release] ${msg}`)
  process.exit(1)
}

function info(msg) {
  console.log(`[publish-release] ${msg}`)
}

function sha256OfFile(path) {
  const hash = createHash('sha256')
  hash.update(readFileSync(path))
  return hash.digest('hex')
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function awsCli(args) {
  if (DRY_RUN) {
    info(`DRY RUN: aws ${args.join(' ')}`)
    return
  }
  const result = spawnSync('aws', args, { stdio: 'inherit' })
  if (result.status !== 0) {
    fail(`aws ${args[0]} failed (exit ${result.status})`)
  }
}

function findReleaseArtifact(suffix, { optional = false } = {}) {
  // electron-builder's nsis-web target produces filenames templated by
  // artifactName in electron-builder.yml. The suffixes we look for are
  // stable across versions so we don't need to mirror the template here.
  const dir = NSIS_WEB_DIR
  if (!existsSync(dir)) {
    fail(`release-builds/nsis-web/ not found — run \`npm run build:win\` first`)
  }
  const entries = readdirSync(dir)
  const match = entries.find((f) => f.endsWith(suffix))
  if (!match) {
    if (optional) return null
    fail(
      `No release-builds/nsis-web artifact ending in '${suffix}' — did the build complete? entries: ${entries.join(', ')}`
    )
  }
  return join(dir, match)
}

// Required config
const BUCKET = process.env.SCS_RELEASES_BUCKET
const CLOUDFRONT_ID = process.env.SCS_CLOUDFRONT_ID
const CHANNEL = process.env.SCS_CHANNEL || 'stable'

if (!BUCKET) fail('SCS_RELEASES_BUCKET env var required')
if (!CLOUDFRONT_ID && !DRY_RUN) {
  // Allow dry-runs without invalidation; a real publish needs it.
  fail('SCS_CLOUDFRONT_ID env var required (use SCS_DRY_RUN=1 to skip)')
}

const pkg = readJson(PACKAGE_JSON_PATH)
const VERSION = pkg.version
const ARCH = 'x64'

info(`publishing v${VERSION} on channel=${CHANNEL} to s3://${BUCKET}`)

// ---- 1-2. Locate + hash artifacts ---------------------------------------
// electron-builder's nsis-web target writes artifacts under release-builds/nsis-web/.
// The stub filename follows the artifactName template in electron-builder.yml
// (currently `${productName}-Setup-${version}.${ext}`). The payload + blockmap
// follow electron-builder's nsis-web internal slugified template
// (`<slugified-productName>-<version>-<arch>.nsis.7z[.blockmap]`).
const stubPath = findReleaseArtifact(`-Setup-${VERSION}.exe`)
const payloadPath = findReleaseArtifact(`-${VERSION}-${ARCH}.nsis.7z`)
// The blockmap is only generated when electron-builder's differentialPackage
// flag finds a previous build to diff against. On a fresh first publish there
// is no previous build, so the blockmap may be absent — that's not a blocker;
// we just skip differential URLs in the manifest.
const blockmapPath = findReleaseArtifact(`-${VERSION}-${ARCH}.nsis.7z.blockmap`, { optional: true })

const stubInfo = {
  size: statSync(stubPath).size,
  sha: sha256OfFile(stubPath)
}
const payloadInfo = {
  size: statSync(payloadPath).size,
  sha: sha256OfFile(payloadPath)
}
info(`stub:    ${stubPath} (${(stubInfo.size / 1024 / 1024).toFixed(1)} MB) sha=${stubInfo.sha.slice(0, 12)}…`)
info(`payload: ${payloadPath} (${(payloadInfo.size / 1024 / 1024).toFixed(1)} MB) sha=${payloadInfo.sha.slice(0, 12)}…`)
if (blockmapPath) {
  info(`blockmap: ${blockmapPath}`)
} else {
  info('blockmap: not generated (first build, or differential disabled) — manifest blockMapUrl will be empty')
}

// ---- 3. Optional: SHA the cached vendor zips ----------------------------
function shaCachedVendor(zipName) {
  const path = join(VENDOR_CACHE_DIR, zipName)
  if (!existsSync(path)) return null
  return { size: statSync(path).size, sha: sha256OfFile(path) }
}

const ipfsCached = shaCachedVendor('kubo_v0.41.0_windows-amd64.zip')
const nginxCached = shaCachedVendor('nginx-1.26.2.zip')
// Optional installer SHAs come from `npm run fetch-optional-components` which
// populates the same vendor/.cache dir. Cache filenames are aligned with the
// COMPONENTS table in fetch-optional-components.mjs.
const ollamaCached = shaCachedVendor('OllamaSetup-0.5.4.exe')
const lmstudioCached = shaCachedVendor('LM-Studio-0.3.5-Setup.exe')

if (ipfsCached) info(`IPFS Kubo:    cached, sha=${ipfsCached.sha.slice(0, 12)}…`)
else info('IPFS Kubo:    not cached (run `npm run fetch-vendor` first to compute SHA, else manifest gets placeholder)')
if (nginxCached) info(`Nginx:        cached, sha=${nginxCached.sha.slice(0, 12)}…`)
else info('Nginx:        not cached')
if (ollamaCached) info(`Ollama:       cached, sha=${ollamaCached.sha.slice(0, 12)}…`)
else info('Ollama:       not cached (run `npm run fetch-optional-components` to compute SHA)')
if (lmstudioCached) info(`LM Studio:    cached, sha=${lmstudioCached.sha.slice(0, 12)}…`)
else info('LM Studio:    not cached')

// ---- 4. Render manifest from fallback-manifest.json template ------------
// The fallback file's structure + URLs are the source of truth; we
// override the dynamic fields (sizeBytes, sha256, app.url, stub.url) with
// the freshly-computed values.
const fallback = readJson(FALLBACK_MANIFEST_PATH)

// Strip the documentation-only `_comment` / `_note` keys before publish.
function stripPrivateKeys(obj) {
  if (Array.isArray(obj)) return obj.map(stripPrivateKeys)
  if (obj && typeof obj === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith('_')) continue
      out[k] = stripPrivateKeys(v)
    }
    return out
  }
  return obj
}

const manifest = stripPrivateKeys(fallback)
manifest.channel = CHANNEL
manifest.publishedAt = new Date().toISOString()
manifest.app = {
  ...manifest.app,
  version: VERSION,
  url: `https://CLOUDFRONT_PLACEHOLDER/releases/${VERSION}/${ARCH}/${basename(payloadPath)}`,
  blockMapUrl: blockmapPath
    ? `https://CLOUDFRONT_PLACEHOLDER/releases/${VERSION}/${ARCH}/${basename(blockmapPath)}`
    : '',
  sha256: payloadInfo.sha,
  sizeBytes: payloadInfo.size
}
manifest.stub = {
  ...manifest.stub,
  minVersion: VERSION,
  url: `https://CLOUDFRONT_PLACEHOLDER/releases/${VERSION}/${ARCH}/${basename(stubPath)}`,
  sha256: stubInfo.sha,
  sizeBytes: stubInfo.size
}

// Patch IPFS / Nginx with real SHAs if we have cached zips.
for (const c of manifest.requiredComponents) {
  if (c.id === 'ipfs' && ipfsCached) {
    c.sha256 = ipfsCached.sha
    c.sizeBytes = ipfsCached.size
  }
  if (c.id === 'nginx' && nginxCached) {
    c.sha256 = nginxCached.sha
    c.sizeBytes = nginxCached.size
  }
}

// Patch Ollama / LM Studio with real SHAs if we have cached installers.
// Without these, the runtime manifest carries the placeholder strings from
// fallback-manifest.json — which the in-app updater would then refuse to use
// (we don't trust an unverified silent installer with elevation). Stub uses
// installer.nsh's hardcoded SHAs (from build/component-shas.nsh), the in-app
// updater path uses these.
for (const c of manifest.optionalComponents) {
  if (c.id === 'ollama' && ollamaCached) {
    c.sha256 = ollamaCached.sha
    c.sizeBytes = ollamaCached.size
  }
  if (c.id === 'lmstudio' && lmstudioCached) {
    c.sha256 = lmstudioCached.sha
    c.sizeBytes = lmstudioCached.size
  }
}

// CloudFront domain — comes from terraform output. We avoid spawning
// `terraform output` here so the script doesn't depend on the user
// running it in the infra/aws/ dir; require the env var instead.
const CF_DOMAIN = process.env.SCS_CF_DOMAIN
if (!CF_DOMAIN) {
  fail(
    'SCS_CF_DOMAIN env var required (e.g. dXXXXX.cloudfront.net or updates.shortcutstudio.app). Get it from `terraform output cloudfront_domain`.'
  )
}
function substCfDomain(obj) {
  for (const k of Object.keys(obj)) {
    if (typeof obj[k] === 'string' && obj[k].includes('CLOUDFRONT_PLACEHOLDER')) {
      obj[k] = obj[k].replace('CLOUDFRONT_PLACEHOLDER', CF_DOMAIN)
    } else if (obj[k] && typeof obj[k] === 'object') {
      substCfDomain(obj[k])
    }
  }
}
substCfDomain(manifest)

// Write manifest to a temp file for upload.
const outDir = join(tmpdir(), 'scs-publish')
mkdirSync(outDir, { recursive: true })
const manifestPath = join(outDir, `${CHANNEL}.json`)
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
info(`manifest:  ${manifestPath}`)

// ---- 5. Upload to S3 ----------------------------------------------------
const releaseKeyPrefix = `releases/${VERSION}/${ARCH}`

awsCli([
  's3',
  'cp',
  payloadPath,
  `s3://${BUCKET}/${releaseKeyPrefix}/${basename(payloadPath)}`,
  '--content-type',
  'application/octet-stream'
])
if (blockmapPath) {
  awsCli([
    's3',
    'cp',
    blockmapPath,
    `s3://${BUCKET}/${releaseKeyPrefix}/${basename(blockmapPath)}`,
    '--content-type',
    'application/octet-stream'
  ])
}
awsCli([
  's3',
  'cp',
  stubPath,
  `s3://${BUCKET}/${releaseKeyPrefix}/${basename(stubPath)}`,
  '--content-type',
  'application/x-msdownload'
])
// Manifest goes to the channel-specific key. NOTE: we upload to a temp
// '.new' suffix first then move to be atomic-ish (S3 doesn't have true
// atomic rename, but two-step minimises the window where a fetcher sees
// half-written JSON).
awsCli([
  's3',
  'cp',
  manifestPath,
  `s3://${BUCKET}/manifests/v1/${CHANNEL}.json.new`,
  '--content-type',
  'application/json',
  '--cache-control',
  'public, max-age=60'
])
awsCli([
  's3',
  'mv',
  `s3://${BUCKET}/manifests/v1/${CHANNEL}.json.new`,
  `s3://${BUCKET}/manifests/v1/${CHANNEL}.json`,
  '--content-type',
  'application/json',
  '--cache-control',
  'public, max-age=60'
])

// ---- 6. CloudFront invalidation -----------------------------------------
awsCli([
  'cloudfront',
  'create-invalidation',
  '--distribution-id',
  CLOUDFRONT_ID,
  '--paths',
  '/v1/manifest.json',
  `/manifests/v1/${CHANNEL}.json`,
  `/${releaseKeyPrefix}/*`
])

info('publish complete')
info(`  Manifest URL: <api endpoint>/v1/manifest.json (served by Lambda from s3://${BUCKET}/manifests/v1/${CHANNEL}.json)`)
info(`  Stub URL:     https://${CF_DOMAIN}/${releaseKeyPrefix}/${basename(stubPath)}`)
info(`  Payload URL:  https://${CF_DOMAIN}/${releaseKeyPrefix}/${basename(payloadPath)}`)
