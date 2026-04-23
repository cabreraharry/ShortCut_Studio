import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'))
const appVersion = pkg.version as string
const buildDate = new Date().toISOString().slice(0, 10)
// Opt-in developer toggle. Set SHOW_DIAGNOSTICS=true in the build/dev env to
// reveal the Diagnostics worker card on Settings. Leave unset (or 'false') for
// release builds — the worker-restart IPC still registers, only the UI hides.
const showDiagnostics = process.env.SHOW_DIAGNOSTICS === 'true'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@main': resolve('src/main')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve('src/renderer'),
        '@shared': resolve('src/shared')
      }
    },
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
      'import.meta.env.VITE_APP_BUILD_DATE': JSON.stringify(buildDate),
      'import.meta.env.VITE_SHOW_DIAGNOSTICS': JSON.stringify(
        showDiagnostics ? 'true' : 'false'
      )
    },
    root: resolve('src/renderer'),
    build: {
      rollupOptions: {
        input: resolve('src/renderer/index.html')
      }
    }
  }
})
