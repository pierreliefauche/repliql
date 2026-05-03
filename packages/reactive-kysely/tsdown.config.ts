import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: './src/index.ts',
    'react/index': './src/react/index.ts',
  },
  format: ['esm', 'cjs'],
  platform: 'browser',
  dts: true,
  clean: true,
  minify: true,
  deps: { neverBundle: ['comlink'] },
})
