import { expose } from 'comlink'

import { isDedicatedPortMessage } from './protocol'

type DedicatedSelf = {
  addEventListener: (type: 'message', listener: (event: MessageEvent) => void) => void
}

/**
 * Exposes the dedicated worker's API on any MessagePort sent to it by its host tab.
 *
 * The host tab creates a `MessageChannel` per leadership cycle and posts one port to
 * the dedicated worker via a `__sdw`-tagged envelope. We listen for that envelope and
 * Comlink-expose the API on the transferred port. The other port is handed to the
 * shared worker, which then talks to this dedicated worker through the channel.
 */
export function exposeToSharedWorker<T>(api: T): void {
  const exposedPorts = new WeakSet<MessagePort>()
  ;(self as unknown as DedicatedSelf).addEventListener('message', (event: MessageEvent) => {
    if (!isDedicatedPortMessage(event.data)) {
      return
    }
    const { port } = event.data
    if (exposedPorts.has(port)) {
      return
    }
    exposedPorts.add(port)
    expose(api, port)
  })
}
