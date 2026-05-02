import { ConduitEventEmitter } from '@repliql/conduit'
import { proxy, Remote, wrap } from 'comlink'

import { CreateCallbackFunctionFn, DriverBridgeRemote } from './types'

export function replayCreateCallbackFunction(opts: {
  events: ConduitEventEmitter
}): CreateCallbackFunctionFn {
  const fns = new Map<string, (...args: any[]) => unknown>()
  let remoteBridge: Remote<DriverBridgeRemote> | null = null

  opts.events.on('leaderElected', ({ port }) => {
    if (!port) {
      return
    }

    remoteBridge = wrap<DriverBridgeRemote>(port)

    // Replay stored callbacks
    for (const [name, cb] of fns.entries()) {
      remoteBridge.createCallbackFunction(name, proxy(cb))
    }
  })

  return function createCallbackFunction(name: string, cb: (...args: any[]) => unknown) {
    fns.set(name, cb)

    if (remoteBridge) {
      remoteBridge.createCallbackFunction(name, proxy(cb))
    }
  }
}
