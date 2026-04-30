// Single source of truth for ShortCut Studio's optional components.
//
// Three consumers read this list:
//   1. The NSIS installer — drives the Components page checkboxes + post-copy
//      cleanup + Finish-page detection labels (build/installer.nsh).
//   2. The renderer's Settings -> Components panel (ComponentsCard.tsx) —
//      shows runtime status + offers download-on-demand for missing bundled
//      components, opens external URLs for absent third-party tools.
//   3. The dev-mode System Check tab — read-only status display via the same
//      detector module.
//
// "bundled" components ship inside our installer at resources/extras/<id>/.
// "external" components are third-party installers we link to but don't host.

export type ComponentId = 'ipfs' | 'nginx' | 'ollama' | 'lmstudio'
export type ComponentCategory = 'bundled' | 'external'
export type ComponentInstallState = 'present' | 'absent' | 'unknown'

export interface OptionalComponent {
  id: ComponentId
  displayName: string
  description: string
  category: ComponentCategory
  // Installer CLI flag. `Setup.exe /S /COMPONENTS=IPFS,NGINX` opts in to those
  // and skips the rest. Absent flag = all-on (back-compat with the v0.4.0
  // installer that had no opt-out).
  cliFlag: string
  // bundled-only: where the binary lives under process.resourcesPath, and the
  // sentinel file we probe to decide if it's installed.
  resourceSubpath?: string
  sentinelFile?: string
  bundleSizeMB?: number
  // bundled-only: keys for the runtime download/extract codepath. Mirror the
  // entries in scripts/fetch-vendor-binaries.mjs so a "missing — install"
  // click in the Settings panel reuses the same source URL.
  vendorFetchKey?: 'ipfs' | 'nginx'
  // external-only: download page opened by Settings -> Components when the
  // tool isn't detected.
  externalUrl?: string
  // external-only: filesystem path where the tool typically installs (used by
  // the NSIS Finish page's IfFileExists check). The renderer detector uses
  // detectPort instead since runtime detection should reflect the running
  // daemon, not the installed binary.
  detectExePath?: string
  // external-only: localhost port to probe for runtime "is it running".
  detectPort?: number
}

export const COMPONENTS: readonly OptionalComponent[] = [
  {
    id: 'ipfs',
    displayName: 'IPFS Kubo',
    description: 'Peer-to-peer transport for shared file processing (dormant in v0.4.0; powers v2 peer-shared scan).',
    category: 'bundled',
    cliFlag: 'IPFS',
    resourceSubpath: 'extras/ipfs',
    sentinelFile: 'ipfs.exe',
    bundleSizeMB: 87,
    vendorFetchKey: 'ipfs'
  },
  {
    id: 'nginx',
    displayName: 'Nginx',
    description: 'Reverse proxy for the ExecEngine HTTP / FastAPI consumer-peer layer (dormant in v0.4.0; ships in v2).',
    category: 'bundled',
    cliFlag: 'NGINX',
    resourceSubpath: 'extras/nginx',
    sentinelFile: 'nginx.exe',
    bundleSizeMB: 3,
    vendorFetchKey: 'nginx'
  },
  {
    id: 'ollama',
    displayName: 'Ollama',
    description: 'Local LLM runtime. Recommended for offline scan — pairs with the Ollama provider on the LLMs page.',
    category: 'external',
    cliFlag: 'OLLAMA_LINK',
    externalUrl: 'https://ollama.com/download',
    detectExePath: '%LOCALAPPDATA%\\Programs\\Ollama\\ollama.exe',
    detectPort: 11434
  },
  {
    id: 'lmstudio',
    displayName: 'LM Studio',
    description: 'Local LLM server with model marketplace. Pairs with the LM Studio provider on the LLMs page.',
    category: 'external',
    cliFlag: 'LMSTUDIO_LINK',
    externalUrl: 'https://lmstudio.ai',
    detectExePath: '%LOCALAPPDATA%\\Programs\\LM Studio\\LM Studio.exe',
    detectPort: 1234
  }
]

// Runtime view of a component. The category-specific fields stay readonly from
// the manifest; `installState` is filled in by the detector at request time.
export interface ComponentStatus extends OptionalComponent {
  installState: ComponentInstallState
  // Optional human-readable detail — e.g. 'Detected on :11434' or 'Bundled'.
  detail?: string
}

export function getComponent(id: ComponentId): OptionalComponent | undefined {
  return COMPONENTS.find((c) => c.id === id)
}
