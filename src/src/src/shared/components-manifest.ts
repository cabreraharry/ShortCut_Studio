// Single source of truth for ShortCut Studio's components.
//
// Three categories (post-v0.5.0 web-stub redesign):
//   - 'required'     IPFS Kubo + Nginx. Mandatory. The web-stub installer
//                    downloads + extracts both at install time. Settings
//                    shows them as status-only; a "Repair install" link
//                    re-launches the stub if files go missing.
//   - 'optional'     Ollama + LM Studio. Large third-party tools the user
//                    can opt into during install (stub runs the silent
//                    installer) or add later from Settings.
//   - 'external-link' Reserved for tools whose silent install we don't
//                    trust. Just a link out to the vendor. None for v0.5.0.
//
// `kind` further distinguishes how the stub installs each one:
//   - 'zip-extract'      INetC-download .zip → SHA-256 verify → 7z-extract
//                        into resources/extras/<id>/
//   - 'silent-installer' INetC-download .exe → SHA-256 verify → ExecWait with
//                        `silentFlags` (e.g. /SILENT for Ollama)
//   - 'external-link'    Just open externalUrl in the browser
//
// At install time the stub fetches a runtime manifest from S3 that overrides
// url / sha256 / version per component; this file is the build-time fallback
// (used when the manifest fetch fails, dev mode, etc.).

export type ComponentId = 'ipfs' | 'nginx' | 'ollama' | 'lmstudio'
export type ComponentCategory = 'required' | 'optional' | 'external-link'
export type ComponentKind = 'zip-extract' | 'silent-installer' | 'external-link'
export type ComponentInstallState = 'present' | 'absent' | 'unknown'

export interface Component {
  id: ComponentId
  displayName: string
  description: string
  category: ComponentCategory
  kind: ComponentKind
  // Stub silent-install opt-in flag. `Setup.exe /S /OPTIONAL=OLLAMA,LMSTUDIO`
  // selects which optional components to install non-interactively. Required
  // components ignore this — they always install.
  cliFlag: string
  // ---- zip-extract (required + optional zip-style) ----
  resourceSubpath?: string  // installs into process.resourcesPath/<this>/
  sentinelFile?: string     // file we probe to decide "is it installed"
  bundleSizeMB?: number     // UI display
  vendorFetchKey?: 'ipfs' | 'nginx'  // build-time vendor key (scripts/fetch-vendor-binaries.mjs); kept for dev `npm run dev` and `build:unpack` paths only
  // ---- silent-installer (Ollama, LM Studio) ----
  silentFlags?: readonly string[]  // e.g. ['/SILENT']
  // ---- silent-installer + external-link ----
  externalUrl?: string      // browser fallback if silent install isn't viable
  detectExePath?: string    // typical install path (informational; Settings probes via detectPort instead)
  detectPort?: number       // localhost port the daemon binds when running
}

export const COMPONENTS: readonly Component[] = [
  {
    id: 'ipfs',
    displayName: 'IPFS Kubo',
    description: 'Peer-to-peer transport for shared file processing. Required by the v2 peer-shared scan path.',
    category: 'required',
    kind: 'zip-extract',
    cliFlag: 'IPFS',
    resourceSubpath: 'extras/ipfs',
    sentinelFile: 'ipfs.exe',
    bundleSizeMB: 41,
    vendorFetchKey: 'ipfs'
  },
  {
    id: 'nginx',
    displayName: 'Nginx',
    description: 'Reverse proxy for the ExecEngine HTTP / FastAPI consumer-peer layer. Required by v2.',
    category: 'required',
    kind: 'zip-extract',
    cliFlag: 'NGINX',
    resourceSubpath: 'extras/nginx',
    sentinelFile: 'nginx.exe',
    bundleSizeMB: 2,
    vendorFetchKey: 'nginx'
  },
  {
    id: 'ollama',
    displayName: 'Ollama',
    description: 'Local LLM runtime. Recommended for offline scan — pairs with the Ollama provider on the LLMs page.',
    category: 'optional',
    kind: 'silent-installer',
    cliFlag: 'OLLAMA',
    silentFlags: ['/SILENT'],
    externalUrl: 'https://ollama.com/download',
    detectExePath: '%LOCALAPPDATA%\\Programs\\Ollama\\ollama.exe',
    detectPort: 11434
  },
  {
    id: 'lmstudio',
    displayName: 'LM Studio',
    description: 'Local LLM server with a model marketplace UI. Pairs with the LM Studio provider on the LLMs page.',
    category: 'optional',
    kind: 'silent-installer',
    cliFlag: 'LMSTUDIO',
    silentFlags: ['/S'],
    externalUrl: 'https://lmstudio.ai',
    detectExePath: '%LOCALAPPDATA%\\Programs\\LM Studio\\LM Studio.exe',
    detectPort: 1234
  }
]

export interface ComponentStatus extends Component {
  installState: ComponentInstallState
  detail?: string
}

export function getComponent(id: ComponentId): Component | undefined {
  return COMPONENTS.find((c) => c.id === id)
}
