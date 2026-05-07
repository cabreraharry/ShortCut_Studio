import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

// Vitest does not read electron-vite.config.ts, so the path aliases used by
// the main + shared sources have to be declared here explicitly. Mirrors the
// `paths` entries in tsconfig.node.json so a test importing main-process code
// (which transitively pulls in `@shared/...`) resolves the same way it does
// at runtime.
export default defineConfig({
  test: {
    // Scope to main-process code. The default `node` environment is correct
    // here. Any future renderer test would need jsdom / happy-dom and will
    // live under src/renderer with its own `// @vitest-environment` pragma —
    // include it here explicitly when that lands.
    include: ['src/main/**/*.test.ts', 'src/shared/**/*.test.ts']
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@main': resolve(__dirname, 'src/main')
    }
  }
})
