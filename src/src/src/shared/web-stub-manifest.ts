// Schema for the runtime manifest fetched by the web-stub installer + the
// in-app updater. This file is the single source of truth for the manifest
// shape — the Lambda function in infra/aws/lambda/manifest/ produces
// objects of this exact type, and the Electron app reads them via the
// updater (Phase 4) and the components UI.
//
// The NSIS stub parses the same JSON via nsJSON; keep field names short
// and free of camelCase deep-nesting where possible since NSIS variable
// names get unwieldy at depth.

export type WebStubChannel = 'stable' | 'beta'

export type WebStubComponentKind = 'zip-extract' | 'silent-installer' | 'external-link'

export interface WebStubAppDescriptor {
  version: string // SemVer; compared against app.getVersion() by the in-app updater
  url: string // .7z payload (electron-builder nsis-web output)
  sha256: string // hex; verified by the stub before extract (Phase 2 v2)
  blockMapUrl: string // .7z.blockmap for differential updates
  sizeBytes: number
}

export interface WebStubComponent {
  id: string // matches ComponentId in components-manifest.ts (e.g. 'ipfs', 'ollama')
  displayName: string
  kind: WebStubComponentKind
  version: string // upstream version (e.g. IPFS 'v0.41.0', Ollama '0.5.4')
  url: string
  sha256: string
  sizeBytes: number
  description: string
  // ---- zip-extract: required + future optional zip-style ----
  extractTo?: string // relative to $INSTDIR\resources\ (e.g. 'extras/ipfs')
  sentinelFile?: string // probe to confirm extract succeeded (e.g. 'ipfs.exe')
  // ---- silent-installer: Ollama, LM Studio ----
  silentFlags?: readonly string[] // e.g. ['/SILENT'] for Ollama
  detectPort?: number // localhost daemon port — used by the Settings → Components detector
  // ---- optional only ----
  defaultSelected?: boolean // pre-checks the box on the Components page
}

export interface WebStubManifest {
  schemaVersion: 1
  channel: WebStubChannel
  publishedAt: string // ISO timestamp; informational
  // Stub binary descriptor. The in-app updater downloads `url` to %TEMP%
  // and re-launches it (the stub then re-fetches the manifest, downloads
  // the new payload, replaces the install, exits). minVersion is a
  // backwards-compat guard — if a running stub is older than this, the
  // in-app updater forces a stub re-download instead of attempting a
  // direct delta apply.
  stub: {
    minVersion: string
    url: string
    sha256: string
    sizeBytes: number
  }
  app: WebStubAppDescriptor
  requiredComponents: WebStubComponent[]
  optionalComponents: WebStubComponent[]
}
