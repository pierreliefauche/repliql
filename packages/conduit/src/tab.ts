import { randomId } from '@repliql/utils'
import type { Remote } from 'comlink'
import { transfer, wrap } from 'comlink'

import { heartbeat as defaultHeartbeat, type Heartbeat } from './heartbeat'
import { type BrokerApi, SDW_DEDICATED_PORT } from './protocol'

export type { Remote }

/**
 * The shared-side bundles `{ user, broker }` over a single Comlink endpoint, with `broker`
 * marked via `Comlink.proxy()` so it chains through. Comlink's generic `Remote<T>`
 * doesn't model nested-proxy chaining for plain-object properties, so we describe
 * the wrapped shape manually.
 */
interface CombinedRemote {
  user: Remote<unknown>
  broker: Remote<BrokerApi>
}

export interface CreateConduitConfig {
  dedicated: Worker
  shared: SharedWorker
  heartbeat?: Heartbeat
}

export interface ConduitHandle {
  tabId: string
  consumeFromSharedWorker<T>(): Remote<T>
  dispose(): Promise<void>
}

/**
 * Wires a tab's dedicated worker to the shared worker:
 *   1. Acquires a per-tab heartbeat lock so the shared worker can detect tab death.
 *   2. Creates a `MessageChannel`, posts one port to the dedicated worker (which
 *      Comlink-exposes its API on it), and hands the other port to the shared
 *      worker via `broker.registerTab`. The shared worker then has a live remote
 *      to this tab's dedicated worker.
 *
 * The tab itself doesn't decide whether it's leader — the shared worker does.
 */
export function createConduit(config: CreateConduitConfig): ConduitHandle {
  const { dedicated, shared, heartbeat = defaultHeartbeat } = config
  const tabId = randomId()
  const wrapped = wrap(shared.port) as unknown as CombinedRemote

  const registerPromise = (async () => {
    await heartbeat.start(tabId)
    const channel = new MessageChannel()
    dedicated.postMessage({ __sdw: SDW_DEDICATED_PORT, port: channel.port1 }, [channel.port1])
    await wrapped.broker.registerTab(tabId, transfer(channel.port2, [channel.port2]))
  })()

  const cleanup = (): void => {
    void wrapped.broker.unregisterTab(tabId)
  }
  if (typeof globalThis !== 'undefined' && 'addEventListener' in globalThis) {
    ;(globalThis as unknown as Window).addEventListener('pagehide', cleanup)
  }

  return {
    tabId,

    consumeFromSharedWorker<T>(): Remote<T> {
      shared.port.start()
      return wrapped.user as Remote<T>
    },

    async dispose() {
      try {
        await registerPromise
      } catch {
        // ignore — registration may have failed; we still attempt cleanup
      }
      try {
        await wrapped.broker.unregisterTab(tabId)
      } catch {
        // ignore — port may already be closed
      }
    },
  }
}
