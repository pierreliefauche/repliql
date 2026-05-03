import { heartbeat, LoggerConfig, makeLogger, randomId } from '@repliql/utils'

import { getHeartbeatId } from './getHeartbeatId'
import { CONDUIT_DEDICATED_PORT, CONDUIT_REGISTER_TAB, CONDUIT_UNREGISTER_TAB } from './protocol'

export interface CreateTabConduitConfig {
  /** Factory for this tab's dedicated worker. */
  loadWorker: () => Worker
  /** Factory for the shared worker. The returned `SharedWorker` is also exposed on the handle. */
  loadSharedWorker: () => SharedWorker
  logger?: LoggerConfig
}

export interface ConduitHandle {
  /** Stable per-tab identifier used for leader election and heartbeats. */
  tabId: string
  /** The shared worker created via `loadSharedWorker`. Wrap `sharedWorker.port` with Comlink to talk to the shared service. */
  sharedWorker: SharedWorker
  /**
   * Best-effort teardown: waits for registration to finish (or fail), then
   * sends an `unregister-tab` envelope so the shared worker can promote
   * another leader without waiting for the heartbeat lock to release.
   */
  dispose(): Promise<void>
}

/**
 * Wires a tab's dedicated worker to the shared worker.
 *
 * On call:
 *   1. Acquires a per-tab heartbeat lock so the shared worker can detect tab
 *      death (default backend: Web Locks).
 *   2. Creates a `MessageChannel`, posts one port to the dedicated worker
 *      (which Comlink-exposes its API on it via `exposeToSharedWorker`), and
 *      hands the other port to the shared worker through a `register-tab`
 *      envelope. The shared worker now holds a live remote to this tab's
 *      dedicated worker.
 *   3. Registers a `pagehide` listener that posts `unregister-tab` so the
 *      shared worker can fail over promptly when the tab is closed.
 *
 * The tab itself doesn't decide whether it's leader — the shared worker's
 * broker does, picking the oldest registered tab and re-electing on death.
 */
export function conduit(config: CreateTabConduitConfig): ConduitHandle {
  const { loadSharedWorker, loadWorker, logger: loggerConfig } = config

  const log = makeLogger({ ...loggerConfig, prefix: `[Conduit] [tab]` })
  const tabId = randomId()

  log.debug('Starting Conduit', { tabId })

  log.debug('Loading workers')
  const sharedWorker = loadSharedWorker()
  const dedicatedWorker = loadWorker()

  const registerPromise = (async () => {
    log.debug('Starting heartbeat')
    await heartbeat.start(getHeartbeatId(tabId))

    sharedWorker.port.start()

    log.debug('Creating channel and handing off ports to workers')
    const channel = new MessageChannel()
    dedicatedWorker.postMessage({ __conduit: CONDUIT_DEDICATED_PORT, port: channel.port1 }, [
      channel.port1,
    ])
    sharedWorker.port.postMessage({ __conduit: CONDUIT_REGISTER_TAB, port: channel.port2, tabId }, [
      channel.port2,
    ])
  })()

  const cleanup = () => {
    log.debug('Cleaning up')
    sharedWorker.port.postMessage({ __conduit: CONDUIT_UNREGISTER_TAB, tabId })
  }

  if (typeof globalThis !== 'undefined' && 'addEventListener' in globalThis) {
    ;(globalThis as unknown as Window).addEventListener('pagehide', cleanup)
  }

  return {
    tabId,

    sharedWorker,

    async dispose() {
      log.debug('Disposing')

      try {
        await registerPromise
      } catch {
        // ignore — registration may have failed; we still attempt cleanup
      }
      cleanup()
    },
  }
}
