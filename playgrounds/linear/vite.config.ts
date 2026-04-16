import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import sqlocal from 'sqlocal/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss(), sqlocal()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 4000,
  },
})
