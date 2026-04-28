import { describe, it, expect } from 'bun:test'

import type { Remote } from 'comlink'

import { Broker } from './Broker'
import type { Heartbeat } from './heartbeat'
import { LeaderResignedError } from './protocol'

interface FakeHeartbeat extends Heartbeat {
  stop(id: string): void
}

function makeFakeHeartbeat(): FakeHeartbeat {
  const stoppers = new Map<string, Array<() => void>>()
  return {
    start: () => Promise.resolve(),
    onStop: (id, callback) => {
      let arr = stoppers.get(id)
      if (!arr) {
        arr = []
        stoppers.set(id, arr)
      }
      arr.push(callback)
    },
    stop(id) {
      const arr = stoppers.get(id)
      if (!arr) {
        return
      }
      stoppers.delete(id)
      for (const cb of arr) {
        cb()
      }
    },
  }
}

interface FakeRemote {
  square: (v: number) => Promise<number>
  ping: () => Promise<string>
  slow: (delay: number, value: number) => Promise<number>
}

function makeRemote(label: string, opts: { multiplier?: number } = {}): Remote<FakeRemote> {
  const { multiplier = 1 } = opts
  const remote: FakeRemote = {
    square: v => Promise.resolve(v * v * multiplier),
    ping: () => Promise.resolve(label),
    slow: (delay, value) =>
      new Promise(resolve => {
        setTimeout(() => resolve(value), delay)
      }),
  }
  return remote as unknown as Remote<FakeRemote>
}

describe('Broker', () => {
  it('promotes the first registered tab and fires onLeaderElected', () => {
    const hb = makeFakeHeartbeat()
    const broker = new Broker(hb)
    const elected: string[] = []
    broker.addListener({ onLeaderElected: id => elected.push(id) })

    broker.register('tab-A', makeRemote('A'))
    expect(elected).toEqual(['tab-A'])
  })

  it('does not re-elect when a second tab registers', () => {
    const hb = makeFakeHeartbeat()
    const broker = new Broker(hb)
    const elected: string[] = []
    broker.addListener({ onLeaderElected: id => elected.push(id) })

    broker.register('tab-A', makeRemote('A'))
    broker.register('tab-B', makeRemote('B'))
    expect(elected).toEqual(['tab-A'])
  })

  it('routes calls to the current leader', async () => {
    const hb = makeFakeHeartbeat()
    const broker = new Broker(hb)
    broker.register('tab-A', makeRemote('A'))
    broker.register('tab-B', makeRemote('B'))

    const result = await broker.callOnLeader(remote => (remote as unknown as FakeRemote).ping())
    expect(result).toBe('A')
  })

  it('queues calls until a leader exists, then flushes', async () => {
    const hb = makeFakeHeartbeat()
    const broker = new Broker(hb)
    const pending = broker.callOnLeader(remote => (remote as unknown as FakeRemote).ping())

    broker.register('tab-A', makeRemote('A'))
    expect(await pending).toBe('A')
  })

  it('fires onLeaderResigned then onLeaderElected on leader death', () => {
    const hb = makeFakeHeartbeat()
    const broker = new Broker(hb)
    const events: string[] = []
    broker.addListener({
      onLeaderElected: id => events.push(`elect:${id}`),
      onLeaderResigned: id => events.push(`resign:${id}`),
    })

    broker.register('tab-A', makeRemote('A'))
    broker.register('tab-B', makeRemote('B'))
    hb.stop('tab-A')
    expect(events).toEqual(['elect:tab-A', 'resign:tab-A', 'elect:tab-B'])
  })

  it('promotes the oldest surviving tab (FIFO)', () => {
    const hb = makeFakeHeartbeat()
    const broker = new Broker(hb)
    const elected: string[] = []
    broker.addListener({ onLeaderElected: id => elected.push(id) })

    broker.register('tab-A', makeRemote('A'))
    broker.register('tab-B', makeRemote('B'))
    broker.register('tab-C', makeRemote('C'))
    hb.stop('tab-A')
    expect(elected).toEqual(['tab-A', 'tab-B'])
  })

  it('routes to the new leader after failover', async () => {
    const hb = makeFakeHeartbeat()
    const broker = new Broker(hb)
    broker.register('tab-A', makeRemote('A'))
    broker.register('tab-B', makeRemote('B'))
    hb.stop('tab-A')

    const result = await broker.callOnLeader(remote => (remote as unknown as FakeRemote).ping())
    expect(result).toBe('B')
  })

  it('queues calls when the only tab dies and resolves on next registration', async () => {
    const hb = makeFakeHeartbeat()
    const broker = new Broker(hb)
    broker.register('tab-A', makeRemote('A'))
    hb.stop('tab-A')

    const pending = broker.callOnLeader(remote => (remote as unknown as FakeRemote).ping())
    broker.register('tab-B', makeRemote('B'))
    expect(await pending).toBe('B')
  })

  it('rejects in-flight calls with LeaderResignedError when leader resigns', async () => {
    const hb = makeFakeHeartbeat()
    const broker = new Broker(hb)
    broker.register('tab-A', makeRemote('A'))
    broker.register('tab-B', makeRemote('B'))

    const pending = broker.callOnLeader(remote => (remote as unknown as FakeRemote).slow(50, 1))
    hb.stop('tab-A')

    await expect(pending).rejects.toBeInstanceOf(LeaderResignedError)
  })

  it('does not reject in-flight calls when a non-leader tab dies', async () => {
    const hb = makeFakeHeartbeat()
    const broker = new Broker(hb)
    broker.register('tab-A', makeRemote('A'))
    broker.register('tab-B', makeRemote('B'))

    const pending = broker.callOnLeader(remote => (remote as unknown as FakeRemote).slow(20, 7))
    hb.stop('tab-B')
    expect(await pending).toBe(7)
  })

  it('addListener fires onLeaderElected immediately if a leader already exists', () => {
    const hb = makeFakeHeartbeat()
    const broker = new Broker(hb)
    broker.register('tab-A', makeRemote('A'))

    const elected: string[] = []
    broker.addListener({ onLeaderElected: id => elected.push(id) })
    expect(elected).toEqual(['tab-A'])
  })

  it('unregisterTab is equivalent to a heartbeat stop', () => {
    const hb = makeFakeHeartbeat()
    const broker = new Broker(hb)
    const events: string[] = []
    broker.addListener({
      onLeaderElected: id => events.push(`elect:${id}`),
      onLeaderResigned: id => events.push(`resign:${id}`),
    })

    broker.register('tab-A', makeRemote('A'))
    broker.register('tab-B', makeRemote('B'))
    broker.unregisterTab('tab-A')
    expect(events).toEqual(['elect:tab-A', 'resign:tab-A', 'elect:tab-B'])
  })
})
