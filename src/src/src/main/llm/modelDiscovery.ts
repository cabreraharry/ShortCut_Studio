import { net } from 'electron'

// Discovery is a single GET per provider that doubles as auth validation:
// a successful response means the credential is valid AND we have a fresh
// model list to populate the Models table with. Test-connection becomes a
// thin wrapper that discards the model list.
//
// Response parsing is provider-specific and intentionally tolerant — providers
// rotate their model catalogs frequently, so we don't filter aggressively.

export interface DiscoveredModels {
  models: string[]
  defaultModel?: string
  /**
   * Set when the provider doesn't expose a discovery endpoint at all and we
   * fell back to a hardcoded list. Caller may want to surface this to the user
   * ("we couldn't enumerate models — using known defaults").
   */
  fallback?: boolean
}

interface DiscoverInput {
  providerName: string
  apiHost: string
  apiKey: string
}

interface RawResponse {
  status: number
  body: string
}

// Lower-level fetch that returns status + body without throwing on non-2xx.
// We can't reuse providers/httpJson.ts because it throws on non-2xx and
// discovery needs to distinguish 401/403 (auth failed) from 404 (endpoint
// not available — fall back) from real network errors.
function rawFetch(opts: {
  url: string
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
}): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = net.request({ method: opts.method ?? 'GET', url: opts.url })
    for (const [k, v] of Object.entries(opts.headers ?? {})) req.setHeader(k, v)
    const chunks: Buffer[] = []
    req.on('response', (res) => {
      res.on('data', (c) => chunks.push(c as Buffer))
      res.on('end', () => {
        resolve({
          status: res.statusCode ?? 0,
          body: Buffer.concat(chunks).toString('utf8')
        })
      })
      res.on('error', reject)
    })
    req.on('error', reject)
    req.end()
  })
}

function trimHost(h: string): string {
  return (h || '').replace(/\/+$/, '')
}

export class AuthFailedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthFailedError'
  }
}

async function discoverOllama(input: DiscoverInput): Promise<DiscoveredModels> {
  const host = trimHost(input.apiHost) || 'http://127.0.0.1:11434'
  const r = await rawFetch({ url: `${host}/api/tags`, method: 'GET' })
  if (r.status === 0) throw new Error('Ollama unreachable — is the daemon running?')
  if (r.status >= 400) throw new Error(`Ollama HTTP ${r.status}: ${r.body.slice(0, 200)}`)
  const parsed = JSON.parse(r.body) as { models?: Array<{ name: string }> }
  const models = (parsed.models ?? []).map((m) => m.name).filter(Boolean)
  return { models, defaultModel: models[0] }
}

async function discoverOpenAI(input: DiscoverInput): Promise<DiscoveredModels> {
  if (!input.apiKey) throw new AuthFailedError('OpenAI: missing API key')
  const host = trimHost(input.apiHost) || 'https://api.openai.com'
  const r = await rawFetch({
    url: `${host}/v1/models`,
    method: 'GET',
    headers: { Authorization: `Bearer ${input.apiKey}` }
  })
  if (r.status === 401 || r.status === 403) throw new AuthFailedError('OpenAI: auth failed')
  if (r.status >= 400) throw new Error(`OpenAI HTTP ${r.status}: ${r.body.slice(0, 200)}`)
  const parsed = JSON.parse(r.body) as { data?: Array<{ id: string }> }
  const all = (parsed.data ?? []).map((m) => m.id)
  // Filter to chat-capable model families. OpenAI returns embeddings + audio
  // models too which aren't relevant for the classifier.
  const models = all.filter((id) => /^(gpt-|o1-|o3-|chatgpt-)/i.test(id)).sort()
  const defaultModel = models.find((m) => /gpt-4o-mini/i.test(m)) ?? models[0]
  return { models, defaultModel }
}

async function discoverClaude(input: DiscoverInput): Promise<DiscoveredModels> {
  if (!input.apiKey) throw new AuthFailedError('Claude: missing API key')
  const host = trimHost(input.apiHost) || 'https://api.anthropic.com'
  const r = await rawFetch({
    url: `${host}/v1/models`,
    method: 'GET',
    headers: {
      'x-api-key': input.apiKey,
      'anthropic-version': '2023-06-01'
    }
  })
  if (r.status === 401 || r.status === 403) throw new AuthFailedError('Claude: auth failed')
  // Anthropic added /v1/models mid-2024. Older accounts return 404. Fall back
  // to a hardcoded list — auth still effectively confirmed because 404 is
  // not an auth failure.
  if (r.status === 404) {
    return {
      models: [
        'claude-opus-4-7',
        'claude-sonnet-4-5',
        'claude-haiku-4-5',
        'claude-3-5-sonnet-latest',
        'claude-3-5-haiku-latest'
      ],
      defaultModel: 'claude-sonnet-4-5',
      fallback: true
    }
  }
  if (r.status >= 400) throw new Error(`Claude HTTP ${r.status}: ${r.body.slice(0, 200)}`)
  const parsed = JSON.parse(r.body) as { data?: Array<{ id: string }> }
  const models = (parsed.data ?? []).map((m) => m.id)
  const defaultModel =
    models.find((m) => /sonnet/i.test(m)) ?? models.find((m) => /opus/i.test(m)) ?? models[0]
  return { models, defaultModel }
}

// Curated list of widely-available HuggingFace Inference Provider models. Used
// as a fallback when the router's `/v1/models` endpoint isn't enumerable for
// the user's account (the router accepts these IDs in chat-completions calls
// regardless of whether the listing is exposed).
const HF_FALLBACK_MODELS = [
  'meta-llama/Llama-3.3-70B-Instruct',
  'meta-llama/Meta-Llama-3.1-70B-Instruct',
  'meta-llama/Meta-Llama-3.1-8B-Instruct',
  'mistralai/Mistral-7B-Instruct-v0.3',
  'mistralai/Mixtral-8x7B-Instruct-v0.1',
  'Qwen/Qwen2.5-72B-Instruct',
  'Qwen/Qwen2.5-7B-Instruct',
  'google/gemma-2-9b-it',
  'google/gemma-2-27b-it',
  'microsoft/Phi-3.5-mini-instruct'
]

async function discoverHuggingFace(input: DiscoverInput): Promise<DiscoveredModels> {
  if (!input.apiKey) throw new AuthFailedError('HuggingFace: missing API token')
  const host = trimHost(input.apiHost) || 'https://router.huggingface.co/v1'
  // Use the auth-only `whoami` endpoint to validate the token. The router's
  // `/v1/models` listing isn't reliably populated for every account, so we
  // validate auth here and serve a curated fallback for the model picker.
  // Users can add specific model IDs via the "Add model" input if they need
  // one outside the curated set (AllowAddModel='Y' in the seed).
  const auth = await rawFetch({
    url: 'https://huggingface.co/api/whoami-v2',
    method: 'GET',
    headers: { Authorization: `Bearer ${input.apiKey}` }
  })
  if (auth.status === 401 || auth.status === 403) {
    throw new AuthFailedError('HuggingFace: auth failed')
  }
  if (auth.status >= 400 && auth.status !== 404) {
    throw new Error(`HuggingFace HTTP ${auth.status}: ${auth.body.slice(0, 200)}`)
  }
  // Try the OpenAI-compatible listing first; if it returns useful rows, use
  // them. Otherwise fall back to the curated list. Either path constitutes a
  // successful auth-validation since whoami already passed.
  let liveModels: string[] = []
  try {
    const r = await rawFetch({
      url: `${host}/models`,
      method: 'GET',
      headers: { Authorization: `Bearer ${input.apiKey}` }
    })
    if (r.status >= 200 && r.status < 300) {
      const parsed = JSON.parse(r.body) as { data?: Array<{ id: string }> }
      liveModels = (parsed.data ?? []).map((m) => m.id).filter(Boolean)
    }
  } catch {
    // Listing endpoint absent or returned non-JSON — fall through to curated.
  }
  const models = liveModels.length > 0 ? liveModels.sort().slice(0, 50) : HF_FALLBACK_MODELS
  const defaultModel =
    models.find((m) => /Llama-3\.3-70B-Instruct/i.test(m)) ??
    models.find((m) => /Llama-3/i.test(m)) ??
    models[0]
  return { models, defaultModel, fallback: liveModels.length === 0 }
}

async function discoverLmStudio(input: DiscoverInput): Promise<DiscoveredModels> {
  const host = trimHost(input.apiHost) || 'http://localhost:1234/v1'
  const r = await rawFetch({ url: `${host}/models`, method: 'GET' })
  if (r.status === 0) throw new Error('LM Studio unreachable — is the local server running?')
  if (r.status >= 400) throw new Error(`LM Studio HTTP ${r.status}: ${r.body.slice(0, 200)}`)
  const parsed = JSON.parse(r.body) as { data?: Array<{ id: string }> }
  const models = (parsed.data ?? []).map((m) => m.id).filter(Boolean)
  return { models, defaultModel: models[0] }
}

async function discoverGemini(input: DiscoverInput): Promise<DiscoveredModels> {
  if (!input.apiKey) throw new AuthFailedError('Gemini: missing API key')
  const host = trimHost(input.apiHost) || 'https://generativelanguage.googleapis.com'
  // Use header-based auth (x-goog-api-key) so the key doesn't end up in URLs.
  // Mirrors the existing classifier adapter convention.
  const r = await rawFetch({
    url: `${host}/v1beta/models`,
    method: 'GET',
    headers: { 'x-goog-api-key': input.apiKey }
  })
  if (r.status === 401 || r.status === 403) throw new AuthFailedError('Gemini: auth failed')
  if (r.status >= 400) throw new Error(`Gemini HTTP ${r.status}: ${r.body.slice(0, 200)}`)
  const parsed = JSON.parse(r.body) as {
    models?: Array<{ name: string; supportedGenerationMethods?: string[] }>
  }
  const models = (parsed.models ?? [])
    .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .sort()
  const defaultModel = models.find((m) => /gemini-2\.0-flash/i.test(m)) ?? models[0]
  return { models, defaultModel }
}

export async function discoverModels(input: DiscoverInput): Promise<DiscoveredModels> {
  const name = input.providerName.toLowerCase()
  switch (name) {
    case 'ollama':
      return discoverOllama(input)
    case 'openai':
      return discoverOpenAI(input)
    case 'claude':
    case 'anthropic':
      return discoverClaude(input)
    case 'gemini':
    case 'google':
      return discoverGemini(input)
    case 'huggingface':
      return discoverHuggingFace(input)
    case 'lm studio':
    case 'lmstudio':
      return discoverLmStudio(input)
    default:
      throw new Error(`Unknown provider for model discovery: ${input.providerName}`)
  }
}
