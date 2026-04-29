import { expose } from 'comlink'

import { isDedicatedPortMessage } from './protocol'

/**
 * Exposes the dedicated worker's API to the shared worker through its host tab.
 *
 * The host tab creates a `MessageChannel` per leadership cycle and posts one
 * port to this dedicated worker via a `__conduit`-tagged envelope. We listen
 * for that envelope and Comlink-`expose` `api` on the transferred port. The
 * other port is handed to the shared worker, which then talks to this
 * dedicated worker through the channel.
 *
 * Idempotent against repeat envelopes for the same port: each port is exposed
 * at most once.
 */
export function exposeToSharedWorker<T>(api: T): void {
  const exposedPorts = new WeakSet<MessagePort>()
  ;(self as DedicatedWorkerGlobalScope).addEventListener('message', (event: MessageEvent) => {
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
