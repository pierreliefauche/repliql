import { conduit } from '@repliql/conduit/dedicated'
import { expose } from 'comlink'

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

conduit({
  onSharedWorkerPort(port) {
    expose(computations, port)
  },
  onElectedLeader() {
    console.log('I am leader now!')
  },
})
