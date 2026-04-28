import type { Remote } from 'comlink'
import { expose, proxy } from 'comlink'

import { Broker, type BrokerListeners } from './Broker'
import { type Heartbeat } from './heartbeat'
import { type BrokerApi } from './protocol'

export interface ConsumeOptions extends BrokerListeners {
  heartbeat?: Heartbeat
}

export interface ExposeOptions {
  heartbeat?: Heartbeat
}

let singletonBroker: Broker<unknown> | null = null

function getBroker<T>(heartbeat?: Heartbeat): Broker<T> {
  if (!singletonBroker) {
    singletonBroker = new Broker(heartbeat)
  }

  return singletonBroker as Broker<T>
}

/**
 * For tests: replace the module-level Broker. Production code should never call this.
 */
export const testOnly = {
  setBroker(broker: Broker<unknown> | null) {
    singletonBroker = broker
  },
}

/**
 * Returns a Remote-like proxy whose method calls are forwarded to the current
 * leader tab's dedicated worker. Calls made before the first leader is elected
 * queue and resolve once a leader registers. Calls in flight when the leader
 * resigns reject with `LeaderResignedError`.
 *
 * Only method-call access is supported (`api.method(args)`); plain property
 * access on the remote is not.
 */
export function consumeFromDedicatedWorker<T extends Record<string, (...a: any[]) => unknown>>(
  opts: ConsumeOptions = {},
): Remote<T> {
  const { heartbeat: hb, onLeaderElected, onLeaderResigned } = opts
  const broker = getBroker<T>(hb)
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
        broker.callOnLeader(remote => {
          const fn = remote[prop]
          if (typeof fn !== 'function') {
            throw new TypeError(`@repliql/conduit: leader has no method "${String(prop)}"`)
          }
          return fn(...args)
        })
    },
  })
}

type SharedWorkerSelf = {
  onconnect: ((e: MessageEvent) => void) | null
}

/**
 * Exposes the user-facing API to connecting tabs, AND simultaneously exposes the
 * internal broker registration endpoint that tabs use to bridge their dedicated workers.
 *
 * Both are bundled into one Comlink proxy `{ user, broker }` so each tab opens one port.
 */
export function exposeToTab<T>(api: T, opts: ExposeOptions = {}): void {
  const broker = getBroker(opts.heartbeat)

  const brokerApi: BrokerApi = {
    registerTab: (tabId, port) => broker.registerTab(tabId, port),
    unregisterTab: tabId => broker.unregisterTab(tabId),
  }

  // Mark brokerApi as ProxyMarked so Comlink chains property access through it
  // instead of trying to clone it as a plain object on remote read.
  const combined = { user: api, broker: proxy(brokerApi) }

  if (typeof self !== 'undefined' && 'onconnect' in (self as object)) {
    ;(self as unknown as SharedWorkerSelf).onconnect = (e: MessageEvent) => {
      const port = (e.ports as MessagePort[])[0]
      if (port) {
        expose(combined, port)
      }
    }
  } else {
    expose(combined)
  }
}
