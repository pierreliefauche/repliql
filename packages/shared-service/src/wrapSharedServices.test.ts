import { describe, expect, it } from 'bun:test'
import type { Remote } from 'comlink'

import type { Heartbeat, SharedServicesConnector } from './types'
import { wrapSharedServices } from './wrapSharedServices'

type Calculator = {
  square: (n: number) => number
  add: (a: number, b: number) => number
}

const mockHeartbeat: Heartbeat = {
  start: () => Promise.resolve(),
  onStop: () => {},
}

interface InvokeCall {
  method: string
  args: unknown[]
}

interface MockConnector {
  connectCalls: string[]
  invokeCalls: InvokeCall[]
  connector: Remote<SharedServicesConnector>
}

function makeMockConnector(): MockConnector {
  const connectCalls: string[] = []
  const invokeCalls: InvokeCall[] = []
  const calculator: Calculator = {
    square: n => {
      invokeCalls.push({ method: 'square', args: [n] })
      return n * n
    },
    add: (a, b) => {
      invokeCalls.push({ method: 'add', args: [a, b] })
      return a + b
    },
  }
  return {
    connectCalls,
    invokeCalls,
    connector: {
      async connect(tabId: string) {
        connectCalls.push(tabId)
      },
      calculator,
    } as unknown as Remote<SharedServicesConnector>,
  }
}

/** Flush microtasks so eager `ensureConnected` settles. */
async function flush(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0))
}

describe('wrapSharedServices', () => {
  it('eagerly calls connect on the connector', async () => {
    const mock = makeMockConnector()
    wrapSharedServices<{ calculator: Calculator }>(mock.connector, { heartbeat: mockHeartbeat })

    await flush()

    expect(mock.connectCalls).toHaveLength(1)
  })

  it('routes a method call through to the per-tab service', async () => {
    const mock = makeMockConnector()
    const services = wrapSharedServices<{ calculator: Calculator }>(mock.connector, {
      heartbeat: mockHeartbeat,
    })

    expect(await services.calculator.square(4)).toBe(16)
    expect(mock.invokeCalls).toEqual([{ method: 'square', args: [4] }])
  })

  it('queues calls until the connect handshake resolves', async () => {
    let resolveConnect!: () => void
    const connectPromise = new Promise<void>(r => {
      resolveConnect = r
    })
    const calculator: Calculator = {
      square: n => n * n,
      add: (a, b) => a + b,
    }
    const connector = {
      connect: () => connectPromise,
      calculator,
    } as unknown as Remote<SharedServicesConnector>

    const services = wrapSharedServices<{ calculator: Calculator }>(connector, {
      heartbeat: mockHeartbeat,
    })

    let resolved = false
    const callPromise = services.calculator.square(3).then(v => {
      resolved = true
      return v
    })

    await flush()
    expect(resolved).toBe(false)

    resolveConnect()
    expect(await callPromise).toBe(9)
    expect(resolved).toBe(true)
  })

  it('shares a single connect across many concurrent calls', async () => {
    const mock = makeMockConnector()
    const services = wrapSharedServices<{ calculator: Calculator }>(mock.connector, {
      heartbeat: mockHeartbeat,
    })

    const [a, b, c] = await Promise.all([
      services.calculator.square(2),
      services.calculator.square(3),
      services.calculator.add(1, 4),
    ])

    expect(a).toBe(4)
    expect(b).toBe(9)
    expect(c).toBe(5)
    expect(mock.connectCalls).toHaveLength(1)
  })

  it('forwards arguments and routes to the correct service method', async () => {
    const mock = makeMockConnector()
    const services = wrapSharedServices<{ calculator: Calculator }>(mock.connector, {
      heartbeat: mockHeartbeat,
    })

    expect(await services.calculator.add(7, 35)).toBe(42)
    expect(mock.invokeCalls.at(-1)).toEqual({ method: 'add', args: [7, 35] })
  })

  it('uses a distinct tab ID per wrapSharedServices invocation', async () => {
    const mockA = makeMockConnector()
    const mockB = makeMockConnector()

    wrapSharedServices<{ calculator: Calculator }>(mockA.connector, { heartbeat: mockHeartbeat })
    wrapSharedServices<{ calculator: Calculator }>(mockB.connector, { heartbeat: mockHeartbeat })

    await flush()

    expect(mockA.connectCalls).toHaveLength(1)
    expect(mockB.connectCalls).toHaveLength(1)
    expect(mockA.connectCalls[0]).not.toBe(mockB.connectCalls[0])
  })

  it('starts the heartbeat before calling connect', async () => {
    const order: string[] = []
    const heartbeat: Heartbeat = {
      start: async () => {
        order.push('heartbeat')
      },
      onStop: () => {},
    }
    const calculator: Calculator = {
      square: n => n * n,
      add: (a, b) => a + b,
    }
    const connector = {
      async connect() {
        order.push('connect')
      },
      calculator,
    } as unknown as Remote<SharedServicesConnector>

    wrapSharedServices<{ calculator: Calculator }>(connector, { heartbeat })

    await flush()

    expect(order).toEqual(['heartbeat', 'connect'])
  })

  it('returns undefined when accessing a symbol property on the proxy', () => {
    const mock = makeMockConnector()
    const services = wrapSharedServices<{ calculator: Calculator }>(mock.connector, {
      heartbeat: mockHeartbeat,
    })

    expect((services as unknown as Record<symbol, unknown>)[Symbol.iterator]).toBeUndefined()
  })
})
