import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts', './src/shared.ts', './src/tab.ts'],
  format: ['esm', 'cjs'],
  platform: 'browser',
  dts: true,
  clean: true,
  minify: true,
  deps: { neverBundle: ['@repliql/utils', 'comlink'] },
})
