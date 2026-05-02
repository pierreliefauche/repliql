import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import type { Plugin, UserConfig } from 'vite'

/**
 * Represents the configuration that SQLocal's Vite plugin accepts.
 * @see {@link https://sqlocal.dev/guide/setup#vite-configuration}
 */
export type VitePluginConfig = {
  /**
   * If set to `false`, the plugin will not add the
   * HTTP response headers required for
   * [cross-origin isolation](https://sqlocal.dev/guide/setup#cross-origin-isolation)
   * to the Vite development server.
   * @default true
   */
  coi?: boolean
}

/**
 * A Vite plugin that tweaks some Vite settings for building apps
 * that use SQLocal.
 * @see {@link https://sqlocal.dev/guide/setup#vite-configuration}
 */
function vitePlugin(config: VitePluginConfig = { coi: true }): Plugin<UserConfig> {
  return {
    name: 'vite-plugin-sqlocal',
    enforce: 'pre',
    config(config): UserConfig {
      return {
        optimizeDeps: {
          ...config.optimizeDeps,
          exclude: [...(config.optimizeDeps?.exclude ?? []), 'sqlocal', '@sqlite.org/sqlite-wasm'],
        },
        worker: {
          ...config.worker,
          format: 'es',
        },
      }
    },
    configureServer(server): void {
      if (config.coi !== false) {
        server.middlewares.use((req, res, next) => {
          if (
            req.url?.includes('dedicated.worker.') ||
            req.headers['referer']?.includes('dedicated.worker.')
          ) {
            res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
            res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
          }

          next()
        })
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), vitePlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 4000,
  },
})
