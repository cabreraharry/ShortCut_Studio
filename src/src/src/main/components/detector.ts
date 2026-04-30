import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app, net } from 'electron'
import {
  COMPONENTS,
  type ComponentStatus,
  type OptionalComponent
} from '@shared/components-manifest'

// Detect whether each optional component is present + give a one-line detail
// for the UI. Two strategies:
//   - bundled: probe sentinel file under process.resourcesPath/<resourceSubpath>
//     (in dev mode the path doesn't exist, so report 'absent').
//   - external: probe the daemon port on localhost. We don't probe the install
//     path because what matters at runtime is "is the server running" — a user
//     might have Ollama installed but not running, in which case scan calls
//     will still fail.

const PORT_PROBE_TIMEOUT_MS = 1500

function bundledExtraDir(): string | null {
  // process.resourcesPath is the install-time resources directory in packaged
  // builds. In dev (`npm run dev`) it points to electron's own resources, so
  // the sentinel won't exist — fine, we just report 'absent'.
  if (!app.isPackaged) return null
  return process.resourcesPath
}

function probeBundledSentinel(component: OptionalComponent): ComponentStatus {
  const base = bundledExtraDir()
  if (!base || !component.resourceSubpath || !component.sentinelFile) {
    return { ...component, installState: 'unknown', detail: 'Dev mode — bundle path not applicable' }
  }
  const sentinel = join(base, component.resourceSubpath, component.sentinelFile)
  if (existsSync(sentinel)) {
    return { ...component, installState: 'present', detail: 'Bundled — installed' }
  }
  return { ...component, installState: 'absent', detail: 'Removed at install (re-add below)' }
}

async function probeLocalPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = net.request({ method: 'GET', url: `http://127.0.0.1:${port}/` })
    let done = false
    const finish = (ok: boolean) => {
      if (done) return
      done = true
      try {
        req.abort()
      } catch {
        // ignore — we only care about the resolution
      }
      resolve(ok)
    }
    const timer = setTimeout(() => finish(false), PORT_PROBE_TIMEOUT_MS)
    req.on('response', (res) => {
      // Any HTTP response (even a 404) means SOMETHING is bound to that port.
      // Good enough as a "is it running" signal — we're not authenticating.
      void res.statusCode
      clearTimeout(timer)
      finish(true)
    })
    req.on('error', () => {
      clearTimeout(timer)
      finish(false)
    })
    try {
      req.end()
    } catch {
      clearTimeout(timer)
      finish(false)
    }
  })
}

async function probeExternal(component: OptionalComponent): Promise<ComponentStatus> {
  if (!component.detectPort) {
    return { ...component, installState: 'unknown', detail: 'No detection configured' }
  }
  const running = await probeLocalPort(component.detectPort)
  if (running) {
    return {
      ...component,
      installState: 'present',
      detail: `Detected on :${component.detectPort}`
    }
  }
  return {
    ...component,
    installState: 'absent',
    detail: `Not detected on :${component.detectPort}`
  }
}

export async function detectAllComponents(): Promise<ComponentStatus[]> {
  return Promise.all(
    COMPONENTS.map((c) => (c.category === 'bundled' ? probeBundledSentinel(c) : probeExternal(c)))
  )
}
