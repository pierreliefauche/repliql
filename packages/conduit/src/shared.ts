import type { Remote } from 'comlink'

import { Broker, BrokerListeners } from './Broker'
import { type Heartbeat } from './heartbeat'
import { isRegisterTabMessage, isUnregisterTabMessage } from './protocol'

export interface SharedConduitConfig {
  /**
   * Override the default Web Locks-based heartbeat. Useful for tests or
   * environments without `navigator.locks`.
   */
  heartbeat?: Heartbeat
}

type OnConnectTabCallback = (port: MessagePort) => void

/**
 * Boots the conduit on the shared worker side. Must be called once at
 * shared-worker startup.
 *
 * Subscribes to `connect` events on the global scope: each connecting tab
 * delivers a `MessagePort` that is used both to relay `register-tab` /
 * `unregister-tab` envelopes (so the internal broker tracks per-tab dedicated
 * workers and elects a leader) and to expose any tab-facing API via
 * `onConnectTab`.
 *
 * Returns:
 * - `wrapDedicatedWorker<T>(listeners?)` — a Comlink-`Remote`-like proxy that
 *   routes method calls to the current leader's dedicated worker.
 * - `onConnectTab(cb)` — register a callback fired with each tab's port, e.g.
 *   to `Comlink.expose` a service to that tab.
 */
export function conduit(config: SharedConduitConfig = {}) {
  const { heartbeat } = config

  const broker = new Broker(heartbeat)
  const connectTabCallbacks = new Set<OnConnectTabCallback>()

  ;(self as unknown as SharedWorkerGlobalScope).addEventListener('connect', ({ ports }) => {
    const port = ports[0]
    if (!port) {
      return
    }

    port.addEventListener('message', ({ data }) => {
      if (isRegisterTabMessage(data)) {
        broker.registerTab(data.tabId, data.port)
      } else if (isUnregisterTabMessage(data)) {
        broker.unregisterTab(data.tabId)
      }
    })

    for (const cb of connectTabCallbacks) {
      cb(port)
    }

    port.start()
  })

  /**
   * Registers a callback invoked with the `MessagePort` of each connecting
   * tab. Typically used to `Comlink.expose` a tab-facing service on the port.
   */
  function onConnectTab(cb: OnConnectTabCallback) {
    connectTabCallbacks.add(cb)
  }

  /**
   * Returns a Comlink-`Remote`-like proxy whose method calls are forwarded to
   * the current leader tab's dedicated worker.
   *
   * Behavior:
   * - Calls made before the first leader is elected queue and resolve once a
   *   leader registers.
   * - Calls in flight when the leader resigns reject with `LeaderResignedError`;
   *   subsequent calls route to the next leader.
   *
   * Only method-call access is supported (`api.method(args)`); plain property
   * access returns `undefined`. The proxy is intentionally non-thenable so that
   * accidentally `await`ing it does not trigger a remote `then` call.
   *
   * Optional `listeners` are forwarded to the broker so the shared worker can
   * react to leader-election events (e.g. to bootstrap leader-only state).
   */
  function wrapDedicatedWorker<T extends Record<string, (...a: any[]) => unknown>>(
    opts: BrokerListeners = {},
  ): Remote<T> {
    const { onLeaderElected, onLeaderResigned } = opts

    if (onLeaderElected || onLeaderResigned) {
      broker.addListener({ onLeaderElected, onLeaderResigned })
    }

    return new Proxy(Object.create(null) as Remote<T>, {
      get(_target, prop: keyof T | symbol) {
        if (typeof prop === 'symbol') {
          return undefined
        }

        // Make the proxy non-thenable so accidental `await proxy` doesn't trigger
        // a remote `then` call.
        if (prop === 'then') {
          return undefined
        }

        return (...args: unknown[]) =>
          (broker as Broker<T>).callOnLeader(remote => {
            const fn = remote[prop]
            if (typeof fn !== 'function') {
              throw new TypeError(`@repliql/conduit: leader has no method "${String(prop)}"`)
            }
            return fn(...args)
          })
      },
    })
  }

  return { wrapDedicatedWorker, onConnectTab }
}
