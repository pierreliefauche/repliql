import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/shared.ts', './src/tab.ts'],
  format: ['esm', 'cjs'],
  platform: 'browser',
  dts: true,
  clean: true,
  minify: true,
  deps: { neverBundle: ['comlink'] },
})
