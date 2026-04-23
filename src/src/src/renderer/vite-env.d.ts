/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION?: string
  readonly VITE_APP_BUILD_DATE?: string
  readonly VITE_SHOW_DIAGNOSTICS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
