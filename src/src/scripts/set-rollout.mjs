#!/usr/bin/env node
// set-rollout.mjs — manage the staged-rollout config (s3://<bucket>/meta/rollout.json).
//
// Usage:
//   node scripts/set-rollout.mjs --staged-channel=beta --staged-percent=10
//   node scripts/set-rollout.mjs --clear         # remove rollout.json (full stable)
//
// Required env:
//   SCS_RELEASES_BUCKET   S3 bucket name
//   SCS_CLOUDFRONT_ID     CloudFront distribution ID (for invalidation)

import { spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

function fail(msg) {
  console.error(`[set-rollout] ${msg}`)
  process.exit(1)
}

function awsCli(args) {
  const result = spawnSync('aws', args, { stdio: 'inherit' })
  if (result.status !== 0) fail(`aws ${args[0]} failed (exit ${result.status})`)
}

const BUCKET = process.env.SCS_RELEASES_BUCKET
const CF_ID = process.env.SCS_CLOUDFRONT_ID
if (!BUCKET) fail('SCS_RELEASES_BUCKET env var required')
if (!CF_ID) fail('SCS_CLOUDFRONT_ID env var required')

const argv = process.argv.slice(2)
const flags = {}
for (const a of argv) {
  const m = a.match(/^--([\w-]+)(?:=(.*))?$/)
  if (m) flags[m[1]] = m[2] ?? true
}

if (flags.clear) {
  console.log(`[set-rollout] removing s3://${BUCKET}/meta/rollout.json (full stable rollout)`)
  awsCli(['s3', 'rm', `s3://${BUCKET}/meta/rollout.json`])
} else {
  const stagedChannel = flags['staged-channel']
  const stagedPercent = parseInt(flags['staged-percent'], 10)
  if (!stagedChannel || !['stable', 'beta'].includes(stagedChannel)) {
    fail('--staged-channel=stable|beta required')
  }
  if (!Number.isFinite(stagedPercent) || stagedPercent < 0 || stagedPercent > 100) {
    fail('--staged-percent=<0..100> required')
  }

  const payload = {
    stagedChannel,
    stagedPercent,
    updatedAt: new Date().toISOString()
  }

  const outDir = join(tmpdir(), 'scs-rollout')
  mkdirSync(outDir, { recursive: true })
  const localPath = join(outDir, 'rollout.json')
  writeFileSync(localPath, JSON.stringify(payload, null, 2))

  console.log(`[set-rollout] uploading rollout.json: ${stagedChannel} @ ${stagedPercent}%`)
  awsCli([
    's3',
    'cp',
    localPath,
    `s3://${BUCKET}/meta/rollout.json`,
    '--content-type',
    'application/json',
    '--cache-control',
    'public, max-age=60'
  ])
}

awsCli([
  'cloudfront',
  'create-invalidation',
  '--distribution-id',
  CF_ID,
  '--paths',
  '/v1/manifest.json'
])

console.log('[set-rollout] done')
