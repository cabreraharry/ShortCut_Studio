// Manifest-serving Lambda. Backs the GET /v1/manifest.json endpoint that
// the NSIS web stub + in-app updater both call.
//
// Behavior:
//   - Reads s3://<RELEASES_BUCKET>/manifests/v1/<channel>.json
//     (channel defaults to 'stable'; ?channel=beta switches).
//   - Optionally reads s3://<RELEASES_BUCKET>/meta/rollout.json which can
//     specify a staged rollout: { stagedPercent: 25, stagedChannel: 'beta' }.
//     If a request includes ?installId=<hex>, the function hashes it and
//     returns the staged channel for the lucky percentile, else falls back
//     to the requested channel.
//   - Sets short Cache-Control so CloudFront refresh after a publish is fast.
//
// Env:
//   RELEASES_BUCKET     S3 bucket name (e.g. shortcutstudio-releases)
//   RELEASES_REGION     AWS region (e.g. us-east-1)
//
// Deployed by infra/aws/lambda-manifest.tf.

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { createHash } from 'node:crypto'

const REGION = process.env.RELEASES_REGION || 'us-east-1'
const BUCKET = process.env.RELEASES_BUCKET
const ALLOWED_CHANNELS = new Set(['stable', 'beta'])

const s3 = new S3Client({ region: REGION })

async function readJsonFromS3(key) {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
  const text = await res.Body.transformToString('utf-8')
  return JSON.parse(text)
}

// Stable rollout bucket: hash(installId) mod 100 < stagedPercent ⇒ in cohort.
// The hash is consistent per installId so the same user always lands in the
// same bucket across requests (you don't get bounced between channels).
function isInStagedCohort(installId, stagedPercent) {
  if (!installId || typeof stagedPercent !== 'number' || stagedPercent <= 0) return false
  if (stagedPercent >= 100) return true
  const h = createHash('sha256').update(installId).digest()
  // Take the first 4 bytes as an unsigned int and mod 100 — uniform enough.
  const bucket = h.readUInt32BE(0) % 100
  return bucket < stagedPercent
}

function jsonResponse(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      // Short TTL so CloudFront serves a fresh manifest within a minute of
      // publish-release.mjs uploading + invalidating. The stub fetches the
      // manifest once per install run, so cache hit rate isn't load-bearing.
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      ...extraHeaders
    },
    body: JSON.stringify(body)
  }
}

export const handler = async (event) => {
  if (!BUCKET) {
    return jsonResponse(500, { error: 'RELEASES_BUCKET env var not configured' })
  }

  const qs = event.queryStringParameters || {}
  const requestedChannel = qs.channel || 'stable'
  if (!ALLOWED_CHANNELS.has(requestedChannel)) {
    return jsonResponse(400, { error: `Unknown channel: ${requestedChannel}` })
  }
  const installId = (qs.installId || '').slice(0, 64) // sanity bound

  // Determine effective channel via optional staged rollout.
  let effectiveChannel = requestedChannel
  try {
    const rollout = await readJsonFromS3('meta/rollout.json').catch(() => null)
    if (rollout && rollout.stagedChannel && ALLOWED_CHANNELS.has(rollout.stagedChannel)) {
      if (isInStagedCohort(installId, rollout.stagedPercent)) {
        effectiveChannel = rollout.stagedChannel
      }
    }
  } catch {
    // rollout.json is optional; missing or malformed = no staging
  }

  let manifest
  try {
    manifest = await readJsonFromS3(`manifests/v1/${effectiveChannel}.json`)
  } catch (err) {
    if (err?.name === 'NoSuchKey') {
      return jsonResponse(404, {
        error: `Manifest not found for channel: ${effectiveChannel}`
      })
    }
    console.error('manifest fetch failed', err)
    return jsonResponse(500, { error: 'Internal error reading manifest' })
  }

  return jsonResponse(200, manifest)
}
