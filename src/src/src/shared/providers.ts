// Provider-name constants shared between main and renderer. Any provider that
// runs locally (no API key required, daemon binds to localhost) belongs here —
// keeping the list in one place avoids drift between the dispatcher's
// no-key-required exemption and the renderer's "Local" badge / no-key UI.
export const LOCAL_PROVIDER_NAMES = ['Ollama', 'LM Studio'] as const

export function isLocalProvider(providerName: string): boolean {
  return (LOCAL_PROVIDER_NAMES as readonly string[]).includes(providerName)
}
