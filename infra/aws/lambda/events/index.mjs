// Event-ingest Lambda. Backs POST /v1/events. Receives install/update
// telemetry from the NSIS stub (Phase 2 PostInstallTelemetry hook, currently
// a no-op) and the in-app updater (Phase 4). Pushes events onto an SQS
// queue; downstream consumers (CloudWatch Logs subscription, Athena, etc.)
// drain it.
//
// Design choice: SQS is a durable buffer between the spiky write rate
// (every install fires an event) and slower analytics. We don't want a
// telemetry blip to ever be a critical path on user installs.
//
// Body schema (loose validation — anything extra is preserved, missing
// required fields rejects the request):
//   {
//     installId: string (required, [a-zA-Z0-9]+, ≤64 chars),
//     event: 'install' | 'update' | 'uninstall' (required),
//     version: string (required),
//     channel: 'stable' | 'beta' (optional),
//     manifestSource: 'live' | 'local' | 'fallback' (optional),
//     requiredComponents: string[] (optional),
//     optionalComponents: string[] (optional),
//     errors: string[] (optional, for failure reporting)
//   }
//
// Env:
//   EVENTS_QUEUE_URL    SQS queue URL
//   EVENTS_REGION       AWS region (e.g. us-east-1)

import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'

const REGION = process.env.EVENTS_REGION || 'us-east-1'
const QUEUE_URL = process.env.EVENTS_QUEUE_URL
const ALLOWED_EVENTS = new Set(['install', 'update', 'uninstall'])

// Hard cap on the request body. Real telemetry payloads are ~500 bytes;
// 8 KB is a generous safety margin. API Gateway HTTP API allows up to 10 MB
// by default, but anything that big into THIS endpoint is junk or abuse —
// SQS message size is also capped at 256 KB so we'd reject downstream
// anyway. Rejecting early avoids the JSON.parse cost and the SQS roundtrip.
const MAX_BODY_BYTES = 8 * 1024

const sqs = new SQSClient({ region: REGION })

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }
}

function safeString(value, max) {
  if (typeof value !== 'string') return null
  if (value.length === 0 || value.length > max) return null
  return value
}

function isHexish(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value)
}

function validate(payload) {
  const errors = []
  const installId = safeString(payload?.installId, 64)
  if (!installId || !isHexish(installId)) errors.push('installId required (alphanumeric, ≤64 chars)')
  const event = payload?.event
  if (!ALLOWED_EVENTS.has(event)) errors.push(`event must be one of ${[...ALLOWED_EVENTS].join('|')}`)
  const version = safeString(payload?.version, 32)
  if (!version) errors.push('version required (≤32 chars)')
  return { installId, event, version, errors }
}

export const handler = async (event) => {
  if (!QUEUE_URL) {
    return jsonResponse(500, { error: 'EVENTS_QUEUE_URL env var not configured' })
  }

  // API Gateway HTTP API delivers the body as a JSON string in event.body.
  // Reject oversized payloads before parsing — JSON.parse on a multi-MB
  // string burns Lambda CPU + memory we shouldn't pay for.
  if (typeof event.body === 'string' && event.body.length > MAX_BODY_BYTES) {
    return jsonResponse(413, { error: `Body exceeds ${MAX_BODY_BYTES} byte cap` })
  }
  let payload
  try {
    payload = typeof event.body === 'string' ? JSON.parse(event.body) : event.body
  } catch {
    return jsonResponse(400, { error: 'Body must be valid JSON' })
  }
  if (!payload || typeof payload !== 'object') {
    return jsonResponse(400, { error: 'Body must be a JSON object' })
  }

  const { errors } = validate(payload)
  if (errors.length) {
    return jsonResponse(400, { error: 'Validation failed', details: errors })
  }

  // Enrich with server-side fields. The client-supplied installId is the
  // grouping key; receivedAt + sourceIp are forensic context.
  const enriched = {
    ...payload,
    receivedAt: new Date().toISOString(),
    sourceIp:
      event.requestContext?.http?.sourceIp ||
      event.requestContext?.identity?.sourceIp ||
      null
  }

  try {
    await sqs.send(
      new SendMessageCommand({
        QueueUrl: QUEUE_URL,
        MessageBody: JSON.stringify(enriched),
        // Group by installId so per-user events stay ordered if we ever
        // switch to a FIFO queue. (Standard queue ignores this header.)
        MessageAttributes: {
          installId: { DataType: 'String', StringValue: payload.installId },
          event: { DataType: 'String', StringValue: payload.event }
        }
      })
    )
  } catch (err) {
    console.error('SQS send failed', err)
    return jsonResponse(500, { error: 'Failed to enqueue event' })
  }

  return { statusCode: 204, headers: {}, body: '' }
}
