import type { ElectronAPI } from '@shared/api'
import { useDevModeStore } from '@/stores/devMode'

const raw: ElectronAPI = window.electronAPI

function shortRepr(v: unknown): string {
  if (v === undefined) return 'undefined'
  try {
    const s = JSON.stringify(v)
    if (s == null) return String(v)
    return s.length > 200 ? s.slice(0, 200) + '…' : s
  } catch {
    return String(v)
  }
}

function estimateSize(v: unknown): number {
  try {
    const s = JSON.stringify(v)
    return s ? s.length : 0
  } catch {
    return 0
  }
}

function wrapMethod(
  namespace: string,
  method: string,
  fn: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  return (...args: unknown[]) => {
    const label = `${namespace}.${method}`
    const started = performance.now()
    const push = (partial: {
      durationMs: number
      resultSize: number
      error?: string
    }): void => {
      useDevModeStore.getState().pushEvent({
        channel: label,
        label,
        args: args.map(shortRepr),
        durationMs: Math.round(partial.durationMs),
        resultSize: partial.resultSize,
        error: partial.error
      })
    }
    let result: unknown
    try {
      result = fn.apply(raw[namespace as keyof ElectronAPI], args)
    } catch (err) {
      push({
        durationMs: performance.now() - started,
        resultSize: 0,
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
    // If the wrapped method returned a Promise, log on settle; otherwise log now.
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      return (result as Promise<unknown>).then(
        (value) => {
          push({
            durationMs: performance.now() - started,
            resultSize: estimateSize(value)
          })
          return value
        },
        (err: unknown) => {
          push({
            durationMs: performance.now() - started,
            resultSize: 0,
            error: err instanceof Error ? err.message : String(err)
          })
          throw err
        }
      )
    }
    push({
      durationMs: performance.now() - started,
      resultSize: estimateSize(result)
    })
    return result
  }
}

function wrapNamespace<T extends object>(name: string, ns: T): T {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(ns) as Array<keyof T & string>) {
    const value = ns[key]
    if (typeof value !== 'function') {
      out[key] = value
      continue
    }
    // Event subscribers (onXxx) return cleanup fns synchronously — don't log.
    if (key.startsWith('on')) {
      out[key] = (value as (...args: unknown[]) => unknown).bind(ns)
      continue
    }
    out[key] = wrapMethod(name, key, value as (...args: unknown[]) => unknown)
  }
  return out as T
}

const wrapped: Record<string, unknown> = {}
for (const key of Object.keys(raw) as Array<keyof ElectronAPI>) {
  wrapped[key] = wrapNamespace(key, raw[key] as object)
}

export const api = wrapped as unknown as ElectronAPI
