import { describe, it, expect, beforeEach } from 'bun:test'

import { heartbeat, type Logger, type Heartbeat } from '@repliql/utils'
import * as Comlink from 'comlink'
import type { Remote } from 'comlink'

import { Broker } from './Broker'
import { ConduitEventEmitter } from './events'
import { getHeartbeatId } from './getHeartbeatId'
import { CONDUIT_REGISTER_TAB } from './protocol'
import { conduit } from './shared'

type DedicatedApi = {
  ping: () => string
  square: (v: number) => number
}

interface FakeHeartbeat extends Heartbeat {
  stop(id: string): void
  _reset(): void
}

// Override the heartbeat object's methods to be controllable in tests
const stoppers = new Map<string, Array<() => void>>()

heartbeat.onStop = (id, callback) => {
  let arr = stoppers.get(id)
  if (!arr) {
    arr = []
    stoppers.set(id, arr)
  }
  arr.push(callback)
}

const fakeHeartbeat: FakeHeartbeat = {
  start: heartbeat.start,
  onStop: heartbeat.onStop,
  stop(tabId) {
    // Use the same ID format as the Broker
    const id = getHeartbeatId(tabId)
    const arr = stoppers.get(id)
    if (!arr) {
      return
    }
    stoppers.delete(id)
    for (const cb of arr) {
      cb()
    }
  },
  _reset() {
    stoppers.clear()
  },
}

const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

function spawnDedicated(label: string, multiplier: number = 1): MessagePort {
  const channel = new MessageChannel()
  const api: DedicatedApi = {
    ping: () => label,
    square: v => v * v * multiplier,
  }
  Comlink.expose(api, channel.port1)
  return channel.port2
}

/**
 * Calls `conduit()` with `self.addEventListener` stubbed to capture the
 * `connect` handler. Returns the conduit handle plus a `connect()` helper
 * that simulates a SharedWorker `connect` event for one tab.
 */
function setupConduit() {
  let connectHandler: ((e: { ports: MessagePort[] }) => void) | null = null
  const orig = self.addEventListener.bind(self)
  ;(self as unknown as { addEventListener: typeof self.addEventListener }).addEventListener = ((
    event: string,
    handler: EventListenerOrEventListenerObject,
  ) => {
    if (event === 'connect') {
      connectHandler = handler as unknown as (e: { ports: MessagePort[] }) => void
    } else {
      orig(event, handler)
    }
  }) as typeof self.addEventListener

  try {
    const handle = conduit()
    if (!connectHandler) {
      throw new Error('conduit() did not register a connect listener')
    }
    return {
      ...handle,
      registerTab(tabId: string, dedicatedPort: MessagePort) {
        const channel = new MessageChannel()
        connectHandler!({ ports: [channel.port1] })
        channel.port2.postMessage({ __conduit: CONDUIT_REGISTER_TAB, tabId, port: dedicatedPort }, [
          dedicatedPort,
        ])
      },
    }
  } finally {
    ;(self as unknown as { addEventListener: typeof self.addEventListener }).addEventListener = orig
  }
}

describe('e2e: Broker + Comlink + MessageChannel', () => {
  beforeEach(() => {
    fakeHeartbeat._reset()
  })

  it("routes calls through Comlink to the leader's dedicated worker", async () => {
    const events = new ConduitEventEmitter()
    const broker = new Broker({ events, logger: noopLogger })

    broker.registerTab('tab-A', spawnDedicated('A', 1))
    broker.registerTab('tab-B', spawnDedicated('B', 10))

    const result = await broker.callOnLeader<number>(remote =>
      (remote as unknown as Remote<DedicatedApi>).square(3),
    )
    expect(result).toBe(9)
  })

  it('fails over to tab-B after tab-A dies', async () => {
    const events = new ConduitEventEmitter()
    const broker = new Broker({ events, logger: noopLogger })

    broker.registerTab('tab-A', spawnDedicated('A', 1))
    broker.registerTab('tab-B', spawnDedicated('B', 10))
    fakeHeartbeat.stop('tab-A')

    const result = await broker.callOnLeader<number>(remote =>
      (remote as unknown as Remote<DedicatedApi>).square(3),
    )
    expect(result).toBe(90)
  })

  it('wrapDedicatedWorker proxy forwards method calls', async () => {
    const { wrapDedicatedWorker, registerTab } = setupConduit()

    const proxy = wrapDedicatedWorker<DedicatedApi>()
    registerTab('tab-A', spawnDedicated('A', 1))

    const result = await proxy.square(4)
    expect(result).toBe(16)
  })

  it('wrapDedicatedWorker queues calls until a leader exists', async () => {
    const { wrapDedicatedWorker, registerTab } = setupConduit()

    const proxy = wrapDedicatedWorker<DedicatedApi>()
    const pending = proxy.square(5)
    registerTab('tab-A', spawnDedicated('A', 1))

    expect(await pending).toBe(25)
  })
})
