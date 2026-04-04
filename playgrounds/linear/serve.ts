import { serve } from 'bun'

import homepage from './index.html'

const PORT = 4000

serve({
  port: PORT,
  routes: {
    '/': homepage,
  },
  // development can also be an object.
  development: {
    // Enable Hot Module Reloading
    hmr: true,

    // Echo console logs from the browser to the terminal
    console: false,
  },
})

console.info(`Web app served at localhost:${PORT}`)
