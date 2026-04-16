import { expose } from 'comlink'

import type { SharedService } from './shared-service'

type SharedWorkerSelf = {
  onconnect: ((e: MessageEvent) => void) | null
}

/**
 * Exposes a SharedService instance so spokes can connect to it via Comlink.
 *
 * - In a SharedWorker context: sets `self.onconnect` so each new tab connection
 *   gets its own Comlink endpoint via the dedicated MessagePort.
 * - In a regular Worker or Electron main process: calls `expose` on the default endpoint.
 */
export function exposeSharedService(service: SharedService): void {
  if (typeof self !== 'undefined' && 'onconnect' in (self as object)) {
    // SharedWorker: each connecting tab provides a dedicated port
    ;(self as unknown as SharedWorkerSelf).onconnect = (e: MessageEvent) => {
      const port = (e.ports as MessagePort[])[0]
      if (port) expose(service, port)
    }
  } else {
    expose(service)
  }
}
