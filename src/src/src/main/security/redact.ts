// Strip patterns that look like API keys / bearer tokens out of strings before
// they hit user-visible toasts, the AppErrors DB, or anywhere else a curious
// human + screen recording could pick them up. The regex set is conservative:
// false positives are fine ("[redacted]" is no worse than the raw fragment),
// false negatives are not (a leaked OpenAI/Anthropic/Google key costs money).
//
// Used at the point an upstream-provider HTTP error is composed into a toast
// or error-DB row — see ipc/llm.ts and the completion adapters.

const PATTERNS: ReadonlyArray<{ name: string; re: RegExp }> = [
  // OpenAI: sk-… (project-keys: sk-proj-…). Up to 100 base64-ish chars.
  { name: 'openai', re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,200}\b/g },
  // Anthropic: sk-ant-… variants.
  { name: 'anthropic', re: /\bsk-ant-[A-Za-z0-9_-]{20,200}\b/g },
  // Google API keys (Gemini, Maps, Cloud): AIza…
  { name: 'google', re: /\bAIza[A-Za-z0-9_-]{30,200}\b/g },
  // HuggingFace user access tokens: hf_…
  { name: 'huggingface', re: /\bhf_[A-Za-z0-9]{20,200}\b/g },
  // Generic Bearer header echoes — catches anything we didn't enumerate
  // above as long as it shows up in `Authorization: Bearer <token>` form.
  { name: 'bearer', re: /(Bearer|Authorization:\s*Bearer)\s+[A-Za-z0-9._\-=+/]{10,400}/gi },
  // x-api-key header echoes (Anthropic, some custom providers).
  { name: 'x-api-key', re: /(x-api-key:\s*)[A-Za-z0-9._\-=+/]{10,400}/gi }
]

export function redactSecrets(text: string | null | undefined): string {
  if (!text) return ''
  let out = String(text)
  for (const { re } of PATTERNS) {
    out = out.replace(re, '[redacted]')
  }
  return out
}
