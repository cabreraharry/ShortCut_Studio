import { shell } from 'electron'
import { recordError } from '../diagnostics/errorStore'

// Centralised allowlist for URLs we'll hand to the OS via shell.openExternal.
// Without this, any caller (the renderer's app.openExternal IPC, the window-
// open handler, the components installer's "Get it" buttons) could be tricked
// into launching arbitrary local executables — `file:///C:/Windows/System32/
// calc.exe` is a one-line RCE on Windows because shell.openExternal delegates
// to ShellExecute, which happily runs binaries.
//
// Only http(s) is permitted today. mailto/tel/etc. could be added if a
// concrete in-app feature needs them.
const ALLOWED_SCHEMES = new Set(['http:', 'https:'])

export function isSafeExternalUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  return ALLOWED_SCHEMES.has(parsed.protocol.toLowerCase())
}

// Returns true on success, false (and logs to AppErrors) when the URL was
// blocked or the OS handler threw. Callers don't need to throw further.
export async function safeOpenExternal(url: string): Promise<boolean> {
  if (!isSafeExternalUrl(url)) {
    recordError({
      source: 'main',
      severity: 'warning',
      category: 'open-external-blocked',
      message: `Refused to open external URL: scheme not allowed`,
      context: {
        // Truncate so the error log doesn't ingest a huge or sensitive blob;
        // the scheme is the part that matters for diagnosing.
        urlPreview: url.slice(0, 200)
      }
    })
    return false
  }
  try {
    await shell.openExternal(url)
    return true
  } catch (err) {
    recordError({
      source: 'main',
      severity: 'error',
      category: 'open-external-failed',
      message: err instanceof Error ? err.message : String(err),
      context: { urlPreview: url.slice(0, 200) }
    })
    return false
  }
}
