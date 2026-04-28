import { exposeToSharedWorker } from '@repliql/conduit/dedicated'

import type { Computations } from './types'

const computations: Computations = {
  square: v => {
    console.log('Computing square')
    return v * v
  },
  abs: v => {
    console.log('Computing abs')
    return Math.abs(v)
  },
}

exposeToSharedWorker(computations)
