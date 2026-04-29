import { conduit } from '@repliql/conduit/shared'
import { expose } from 'comlink'

import type { Computations, CounterService } from './types'

const { wrapDedicatedWorker, onConnectTab } = conduit()

const computations = wrapDedicatedWorker<Computations>({
  onLeaderElected: id => {
    console.log('[conduit shared] leader elected:', id)
  },
  onLeaderResigned: id => {
    console.log('[conduit shared] leader resigned:', id)
  },
})

let counter = 0

const service: CounterService = {
  increment(offset) {
    counter += offset
  },
  getValue() {
    return counter
  },
  getSquare() {
    return computations.square(counter)
  },
  getAbs() {
    return computations.abs(counter)
  },
}

onConnectTab(port => {
  expose(service, port)
})
