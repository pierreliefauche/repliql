import { consumeFromDedicatedWorker, exposeToTab } from '@repliql/conduit/shared'

import type { Computations, CounterService } from './types'

const computations = consumeFromDedicatedWorker<Computations>({
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

exposeToTab(service)
