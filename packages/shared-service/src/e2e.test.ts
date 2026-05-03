import { describe, expect, it } from 'bun:test'

import type { Remote } from 'comlink'

import { SharedServicesManager } from './SharedServicesManager'
import type { Heartbeat, Service, SharedServicesConnector } from './types'
import { wrapSharedServices } from './wrapSharedServices'

const mockHeartbeat: Heartbeat = {
  start: () => Promise.resolve(),
  onStop: () => {},
}

type Calculator = {
  square: (n: number) => number
  add: (a: number, b: number) => number
}

type Counter = {
  inc: () => number
  get: () => number
}

type Echo = {
  echo: (msg: string) => Promise<string>
}

/**
 * Returns a fresh per-spoke connector cast as a `Remote<SharedServicesConnector>`.
 * In production each tab port gets its own `Comlink.expose(manager.connector, port)`;
 * here we skip the MessagePort layer and pass the connector through directly.
 */
function newSpokeConnector<T extends Record<string, Service>>(
  manager: SharedServicesManager<T>,
): Remote<SharedServicesConnector> {
  return manager.connector as unknown as Remote<SharedServicesConnector>
}

describe('e2e: SharedServicesManager + wrapSharedServices', () => {
  it('round-trips a method call from spoke to hub and back', async () => {
    const manager = new SharedServicesManager<{ calculator: Calculator }>({
      heartbeat: mockHeartbeat,
      services: {
        calculator: {
          onConnectTab: () => ({
            square: n => n * n,
            add: (a, b) => a + b,
          }),
        },
      },
    })

    const services = wrapSharedServices<{ calculator: Calculator }>(newSpokeConnector(manager), {
      heartbeat: mockHeartbeat,
    })

    expect(await services.calculator.square(7)).toBe(49)
    expect(await services.calculator.add(10, 32)).toBe(42)
  })

  it('keeps per-tab state isolated across two spokes', async () => {
    const manager = new SharedServicesManager<{ counter: Counter }>({
      heartbeat: mockHeartbeat,
      services: {
        counter: {
          onConnectTab: () => {
            let n = 0
            return {
              inc: () => ++n,
              get: () => n,
            }
          },
        },
      },
    })

    const tabA = wrapSharedServices<{ counter: Counter }>(newSpokeConnector(manager), {
      heartbeat: mockHeartbeat,
    })
    const tabB = wrapSharedServices<{ counter: Counter }>(newSpokeConnector(manager), {
      heartbeat: mockHeartbeat,
    })

    await tabA.counter.inc()
    await tabA.counter.inc()
    await tabA.counter.inc()
    await tabB.counter.inc()

    expect(await tabA.counter.get()).toBe(3)
    expect(await tabB.counter.get()).toBe(1)
  })

  it('invokes onDisconnectTab with the per-tab instance when the spoke heartbeat dies', async () => {
    const stoppers = new Map<string, () => void>()
    const heartbeat: Heartbeat = {
      start: () => Promise.resolve(),
      onStop: (id, cb) => {
        stoppers.set(id, cb)
      },
    }

    const disconnected: Array<{ tabId: string; instance: Counter }> = []
    const manager = new SharedServicesManager<{ counter: Counter }>({
      heartbeat,
      services: {
        counter: {
          onConnectTab: () => {
            let n = 7
            return { inc: () => ++n, get: () => n }
          },
          onDisconnectTab: (tabId, instance) => {
            disconnected.push({ tabId, instance })
          },
        },
      },
    })

    const services = wrapSharedServices<{ counter: Counter }>(newSpokeConnector(manager), {
      heartbeat: mockHeartbeat,
    })
    await services.counter.inc()

    expect(stoppers.size).toBe(1)
    const stop = [...stoppers.values()][0]!
    stop()

    expect(disconnected).toHaveLength(1)
    // The per-tab instance is handed back: counter started at 7 and was bumped once.
    expect(disconnected[0]?.instance.get()).toBe(8)
  })

  it('hosts multiple services on the same manager from a single spoke', async () => {
    const manager = new SharedServicesManager<{ calculator: Calculator; counter: Counter }>({
      heartbeat: mockHeartbeat,
      services: {
        calculator: { onConnectTab: () => ({ square: n => n * n, add: (a, b) => a + b }) },
        counter: {
          onConnectTab: () => {
            let n = 0
            return { inc: () => ++n, get: () => n }
          },
        },
      },
    })

    const services = wrapSharedServices<{ calculator: Calculator; counter: Counter }>(
      newSpokeConnector(manager),
      { heartbeat: mockHeartbeat },
    )

    expect(await services.calculator.square(6)).toBe(36)
    expect(await services.counter.inc()).toBe(1)
    expect(await services.counter.inc()).toBe(2)
    expect(await services.calculator.add(40, 2)).toBe(42)
  })

  it('routes async service methods', async () => {
    let nextId = 0
    const manager = new SharedServicesManager<{ echo: Echo }>({
      heartbeat: mockHeartbeat,
      services: {
        echo: {
          onConnectTab: () => {
            const localId = ++nextId
            return {
              echo: async msg => {
                await Promise.resolve()
                return `${localId}:${msg}`
              },
            }
          },
        },
      },
    })

    const tabA = wrapSharedServices<{ echo: Echo }>(newSpokeConnector(manager), {
      heartbeat: mockHeartbeat,
    })
    const tabB = wrapSharedServices<{ echo: Echo }>(newSpokeConnector(manager), {
      heartbeat: mockHeartbeat,
    })

    const [a, b] = await Promise.all([tabA.echo.echo('hi'), tabB.echo.echo('hi')])

    expect(a).not.toBe(b)
    expect(a.endsWith(':hi')).toBe(true)
    expect(b.endsWith(':hi')).toBe(true)
  })

  it('connects only once across many concurrent calls from the same spoke', async () => {
    const connected: string[] = []
    const manager = new SharedServicesManager<{ calculator: Calculator }>({
      heartbeat: mockHeartbeat,
      services: {
        calculator: {
          onConnectTab: tabId => {
            connected.push(tabId)
            return { square: n => n * n, add: (a, b) => a + b }
          },
        },
      },
    })

    const services = wrapSharedServices<{ calculator: Calculator }>(newSpokeConnector(manager), {
      heartbeat: mockHeartbeat,
    })

    const results = await Promise.all([
      services.calculator.square(2),
      services.calculator.square(3),
      services.calculator.square(4),
      services.calculator.add(1, 2),
    ])

    expect(results).toEqual([4, 9, 16, 3])
    expect(connected).toHaveLength(1)
  })
})
