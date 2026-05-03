import { describe, expect, it } from 'bun:test'

import { SharedServicesManager } from './SharedServicesManager'
import type { Heartbeat, SharedService } from './types'

const mockHeartbeat: Heartbeat = {
  start: () => Promise.resolve(),
  onStop: () => {},
}

type Calculator = {
  square: (n: number) => number
}

type Counter = {
  inc: () => number
  get: () => number
}

function makeCalculatorService(): SharedService<Calculator> & {
  connected: string[]
  disconnected: Array<{ tabId: string; instance: Calculator }>
} {
  const connected: string[] = []
  const disconnected: Array<{ tabId: string; instance: Calculator }> = []
  return {
    connected,
    disconnected,
    onConnectTab(tabId) {
      connected.push(tabId)
      return { square: n => n * n }
    },
    onDisconnectTab(tabId, instance) {
      disconnected.push({ tabId, instance })
    },
  }
}

function makeCounterService(): SharedService<Counter> {
  return {
    onConnectTab() {
      let n = 0
      return {
        inc: () => ++n,
        get: () => n,
      }
    },
  }
}

describe('SharedServicesManager', () => {
  it('builds per-tab service instances on connect', () => {
    const calculator = makeCalculatorService()
    const manager = new SharedServicesManager<{ calculator: Calculator }>({
      heartbeat: mockHeartbeat,
      services: { calculator },
    })

    manager.connector.connect('tab-A')
    expect(calculator.connected).toEqual(['tab-A'])
  })

  it('exposes service methods on the connector after connect', () => {
    const manager = new SharedServicesManager<{ calculator: Calculator }>({
      heartbeat: mockHeartbeat,
      services: { calculator: makeCalculatorService() },
    })

    const conn = manager.connector as unknown as { connect: (id: string) => void } & {
      calculator: Calculator
    }
    conn.connect('tab-A')
    expect(conn.calculator.square(3)).toBe(9)
  })

  it('clears the connect method after the handshake', () => {
    const manager = new SharedServicesManager<{ calculator: Calculator }>({
      heartbeat: mockHeartbeat,
      services: { calculator: makeCalculatorService() },
    })

    const conn = manager.connector as unknown as Record<string, unknown>
    ;(conn.connect as (id: string) => void)('tab-A')
    expect(conn.connect).toBeUndefined()
  })

  it('gives each tab its own instance via a fresh connector', () => {
    const manager = new SharedServicesManager<{ counter: Counter }>({
      heartbeat: mockHeartbeat,
      services: { counter: makeCounterService() },
    })

    const a = manager.connector as unknown as { connect: (id: string) => void } & {
      counter: Counter
    }
    a.connect('tab-A')
    const b = manager.connector as unknown as { connect: (id: string) => void } & {
      counter: Counter
    }
    b.connect('tab-B')

    a.counter.inc()
    a.counter.inc()
    b.counter.inc()

    expect(a.counter.get()).toBe(2)
    expect(b.counter.get()).toBe(1)
  })

  it('hosts multiple services side by side', () => {
    const manager = new SharedServicesManager<{
      calculator: Calculator
      counter: Counter
    }>({
      heartbeat: mockHeartbeat,
      services: {
        calculator: makeCalculatorService(),
        counter: makeCounterService(),
      },
    })

    const conn = manager.connector as unknown as { connect: (id: string) => void } & {
      calculator: Calculator
      counter: Counter
    }
    conn.connect('tab-A')

    expect(conn.calculator.square(5)).toBe(25)
    expect(conn.counter.inc()).toBe(1)
  })

  it('calls onDisconnectTab with the per-tab instance when the heartbeat fires', () => {
    const stoppers = new Map<string, () => void>()
    const heartbeat: Heartbeat = {
      start: () => Promise.resolve(),
      onStop: (id, cb) => {
        stoppers.set(id, cb)
      },
    }

    const calculator = makeCalculatorService()
    const manager = new SharedServicesManager<{ calculator: Calculator }>({
      heartbeat,
      services: { calculator },
    })

    const conn = manager.connector as unknown as { connect: (id: string) => void } & {
      calculator: Calculator
    }
    conn.connect('tab-A')
    expect(calculator.disconnected).toEqual([])

    const stopFn = [...stoppers.values()][0]
    stopFn?.()

    expect(calculator.disconnected).toHaveLength(1)
    expect(calculator.disconnected[0]?.tabId).toBe('tab-A')
    // The disconnect callback receives the live per-tab instance.
    expect(calculator.disconnected[0]?.instance.square(4)).toBe(16)
  })
})
