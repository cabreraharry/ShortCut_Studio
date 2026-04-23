export const APP_NAME = 'ShortCut Studio'
export const APP_VERSION =
  (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '0.0.0'
export const APP_BUILD_DATE =
  (import.meta.env.VITE_APP_BUILD_DATE as string | undefined) ?? 'dev'
export const SHOW_DIAGNOSTICS =
  (import.meta.env.VITE_SHOW_DIAGNOSTICS as string | undefined) === 'true'
