import { describe, it, expect } from 'bun:test'

import {
  type Exchange,
  type Operation,
  type OperationResult,
  createRequest,
  gql,
  makeOperation,
  makeResult,
} from '@urql/core'
import { makeSubject, pipe, subscribe } from 'wonka'

import { SharedExchangeService as SharedService } from './SharedExchangeService'
import type { SerializedOperation, SerializedResult, SharedExchange, SpokeCallbacks } from './types'
import { serializeOp } from './utils'

const testDoc = gql`
  query TestQuery {
    value
  }
`
const testCtx = { url: 'http://test.example', requestPolicy: 'cache-first' as const }

function makeTestOp(kind: 'query' | 'mutation' | 'subscription' = 'query'): Operation {
  return makeOperation(kind, createRequest(testDoc, {}), testCtx)
}

function makeMockCallbacks(): {
  callbacks: SpokeCallbacks
  results: SerializedResult[]
  forwards: SerializedOperation[]
  reexecutes: SerializedOperation[]
} {
  const results: SerializedResult[] = []
  const forwards: SerializedOperation[] = []
  const reexecutes: SerializedOperation[] = []

  return {
    callbacks: {
      onResult: r => results.push(r),
      onForward: op => forwards.push(op),
      onReexecute: op => reexecutes.push(op),
    },
    results,
    forwards,
    reexecutes,
  }
}

/** Connects a spoke to the service and registers callbacks in one call. */
function connectSpoke(
  service: SharedService,
  spokeId: string,
): {
  exchange: SharedExchange
  results: SerializedResult[]
  forwards: SerializedOperation[]
  reexecutes: SerializedOperation[]
} {
  const mock = makeMockCallbacks()
  const exchange = service.onConnectTab(spokeId)
  exchange.register(mock.callbacks)
  return {
    exchange,
    results: mock.results,
    forwards: mock.forwards,
    reexecutes: mock.reexecutes,
  }
}

/** Exchange that records every operation it receives and emits nothing (allows manual result pushing). */
function makeRecordingExchange(): {
  exchange: Exchange
  ops: Operation[]
  pushResult: (r: OperationResult) => void
} {
  const ops: Operation[] = []
  const resultSubject = makeSubject<OperationResult>()

  const exchange: Exchange = () => ops$ => {
    pipe(
      ops$,
      subscribe(op => ops.push(op)),
    )
    return resultSubject.source
  }

  return { exchange, ops, pushResult: r => resultSubject.next(r) }
}

/** Exchange that forwards all non-teardown ops through forward (simulates 100% cache miss). */
const forwardAllExchange: Exchange =
  ({ forward }) =>
  ops$ =>
    forward(ops$)

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SharedService', () => {
  describe('rule #2 — teardown only when all spokes are done', () => {
    it('does not forward teardown while other spokes are still subscribed', () => {
      const { exchange, ops } = makeRecordingExchange()
      const service = new SharedService({ exchange })

      const spokeA = connectSpoke(service, 'A')
      const spokeB = connectSpoke(service, 'B')

      const sub = makeTestOp('subscription')
      spokeA.exchange.executeOperation(serializeOp(sub))
      spokeB.exchange.executeOperation(serializeOp(sub)) // same key — deduped

      const initialOps = ops.filter(o => o.kind !== 'teardown').length
      expect(initialOps).toBe(1) // one subscription op

      spokeA.exchange.teardownOperation(sub.key)
      const teardownsAfterA = ops.filter(o => o.kind === 'teardown').length
      expect(teardownsAfterA).toBe(0) // B still active

      spokeB.exchange.teardownOperation(sub.key)
      const teardownsAfterB = ops.filter(o => o.kind === 'teardown').length
      expect(teardownsAfterB).toBe(1) // now the exchange sees the teardown
    })

    it('forwards teardown immediately when only one spoke was subscribed', () => {
      const { exchange, ops } = makeRecordingExchange()
      const service = new SharedService({ exchange })

      const spokeA = connectSpoke(service, 'A')

      const query = makeTestOp('query')
      spokeA.exchange.executeOperation(serializeOp(query))
      spokeA.exchange.teardownOperation(query.key)

      const teardowns = ops.filter(o => o.kind === 'teardown')
      expect(teardowns).toHaveLength(1)
    })
  })

  describe('rule #4 — subscription deduplication', () => {
    it('sends only one subscription op even when two spokes subscribe to the same key', () => {
      const { exchange, ops } = makeRecordingExchange()
      const service = new SharedService({ exchange })

      const spokeA = connectSpoke(service, 'A')
      const spokeB = connectSpoke(service, 'B')

      const sub = makeTestOp('subscription')
      spokeA.exchange.executeOperation(serializeOp(sub))
      spokeB.exchange.executeOperation(serializeOp(sub)) // same key

      const subOps = ops.filter(o => o.kind === 'subscription')
      expect(subOps).toHaveLength(1)
    })

    it('does NOT deduplicate queries — each spoke triggers its own execution', () => {
      const { exchange, ops } = makeRecordingExchange()
      const service = new SharedService({ exchange })

      const spokeA = connectSpoke(service, 'A')
      const spokeB = connectSpoke(service, 'B')

      const query = makeTestOp('query')
      spokeA.exchange.executeOperation(serializeOp(query))
      spokeB.exchange.executeOperation(serializeOp(query)) // same key, not deduped

      const queryOps = ops.filter(o => o.kind === 'query')
      expect(queryOps).toHaveLength(2)
    })
  })

  describe('result broadcasting', () => {
    it('sends results to all spokes subscribed to the operation key', () => {
      const { exchange, pushResult } = makeRecordingExchange()
      const service = new SharedService({ exchange })

      const spokeA = connectSpoke(service, 'A')
      const spokeB = connectSpoke(service, 'B')

      const query = makeTestOp('query')
      spokeA.exchange.executeOperation(serializeOp(query))
      spokeB.exchange.executeOperation(serializeOp(query))

      pushResult(makeResult(query, { data: { value: 1 } }))

      expect(spokeA.results).toHaveLength(1)
      expect(spokeB.results).toHaveLength(1)
      expect(spokeA.results[0]?.data).toEqual({ value: 1 })
      expect(spokeB.results[0]?.data).toEqual({ value: 1 })
    })

    it('does not send results to spokes that have torn down', () => {
      const { exchange, pushResult } = makeRecordingExchange()
      const service = new SharedService({ exchange })

      const spokeA = connectSpoke(service, 'A')
      const spokeB = connectSpoke(service, 'B')

      const query = makeTestOp('query')
      spokeA.exchange.executeOperation(serializeOp(query))
      spokeB.exchange.executeOperation(serializeOp(query))

      // A tears down — still waiting for B
      spokeA.exchange.teardownOperation(query.key)

      pushResult(makeResult(query, { data: { value: 2 } }))

      expect(spokeA.results).toHaveLength(0) // A no longer subscribed
      expect(spokeB.results).toHaveLength(1)
    })
  })

  describe('forward path', () => {
    it('calls onForward on the owner spoke when the exchange calls forward', () => {
      const service = new SharedService({ exchange: forwardAllExchange })

      const spokeA = connectSpoke(service, 'A')

      const query = makeTestOp('query')
      spokeA.exchange.executeOperation(serializeOp(query))

      expect(spokeA.forwards).toHaveLength(1)
      expect(spokeA.forwards[0]?.key).toBe(query.key)
    })

    it('resolveForwarded pushes the result back through the exchange and to the spoke', () => {
      const service = new SharedService({ exchange: forwardAllExchange })

      const spokeA = connectSpoke(service, 'A')

      const query = makeTestOp('query')
      spokeA.exchange.executeOperation(serializeOp(query))
      expect(spokeA.forwards).toHaveLength(1)

      const fakeResult: SerializedResult = {
        handle: query.key,
        key: query.key,
        data: { value: 99 },
        stale: false,
        hasNext: false,
      }
      spokeA.exchange.resolveForwarded(query.key, fakeResult)

      expect(spokeA.results).toHaveLength(1)
      expect(spokeA.results[0]?.data).toEqual({ value: 99 })
    })

    it('forwards teardown to the spoke that triggered it (last unsubscriber), not the original forwarding spoke', () => {
      const service = new SharedService({ exchange: forwardAllExchange })

      const spokeA = connectSpoke(service, 'A')
      const spokeB = connectSpoke(service, 'B')

      const sub = makeTestOp('subscription')
      // A subscribes first (becomes the forward handler)
      spokeA.exchange.executeOperation(serializeOp(sub))
      // B subscribes to same key
      spokeB.exchange.executeOperation(serializeOp(sub))

      // Only A should receive the initial forward (it's the owner)
      expect(spokeA.forwards.filter(f => f.kind === 'subscription')).toHaveLength(1)
      expect(spokeB.forwards.filter(f => f.kind === 'subscription')).toHaveLength(0)

      // A tears down first (B still active) — subscription hands off to B
      spokeA.exchange.teardownOperation(sub.key)
      // A gets teardown to stop its forward, B gets subscription to take over
      expect(spokeA.forwards.filter(f => f.kind === 'teardown')).toHaveLength(1)
      expect(spokeB.forwards.filter(f => f.kind === 'subscription')).toHaveLength(1)

      // B tears down last, triggering the full teardown
      spokeB.exchange.teardownOperation(sub.key)

      // B should receive one more teardown (the final one)
      expect(spokeA.forwards.filter(f => f.kind === 'teardown')).toHaveLength(1) // still just the handoff teardown
      expect(spokeB.forwards.filter(f => f.kind === 'teardown')).toHaveLength(1) // the final teardown
      expect(spokeB.forwards.find(f => f.kind === 'teardown')?.key).toBe(sub.key)
    })

    it('hands off subscription to another spoke when the forwarding spoke disconnects', () => {
      const service = new SharedService({ exchange: forwardAllExchange })

      const spokeA = connectSpoke(service, 'A')
      const spokeB = connectSpoke(service, 'B')
      const spokeC = connectSpoke(service, 'C')

      const sub = makeTestOp('subscription')
      // All three subscribe to the same subscription
      spokeA.exchange.executeOperation(serializeOp(sub))
      spokeB.exchange.executeOperation(serializeOp(sub))
      spokeC.exchange.executeOperation(serializeOp(sub))

      // Only A (first subscriber) receives the forward
      expect(spokeA.forwards.filter(f => f.kind === 'subscription')).toHaveLength(1)
      expect(spokeB.forwards.filter(f => f.kind === 'subscription')).toHaveLength(0)
      expect(spokeC.forwards.filter(f => f.kind === 'subscription')).toHaveLength(0)

      // A disconnects — subscription should hand off to B (next in line)
      service.onDisconnectTab('A')
      expect(spokeA.forwards.filter(f => f.kind === 'teardown')).toHaveLength(1) // A's forward is torn down
      expect(spokeB.forwards.filter(f => f.kind === 'subscription')).toHaveLength(1) // B takes over
      expect(spokeC.forwards.filter(f => f.kind === 'subscription')).toHaveLength(0) // C still just listening

      // B disconnects — subscription should hand off to C
      service.onDisconnectTab('B')
      expect(spokeB.forwards.filter(f => f.kind === 'teardown')).toHaveLength(1) // B's forward is torn down
      expect(spokeC.forwards.filter(f => f.kind === 'subscription')).toHaveLength(1) // C takes over

      // C disconnects — final teardown
      service.onDisconnectTab('C')
      expect(spokeC.forwards.filter(f => f.kind === 'teardown')).toHaveLength(1) // C gets final teardown
    })

    it('forwards teardown to the only spoke when it tears down', () => {
      const service = new SharedService({ exchange: forwardAllExchange })

      const spokeA = connectSpoke(service, 'A')

      const query = makeTestOp('query')
      spokeA.exchange.executeOperation(serializeOp(query))

      // A receives the forward
      expect(spokeA.forwards.filter(f => f.kind === 'query')).toHaveLength(1)

      // A tears down
      spokeA.exchange.teardownOperation(query.key)

      // A should receive the teardown forward since it's the only/triggering spoke
      expect(spokeA.forwards.filter(f => f.kind === 'teardown')).toHaveLength(1)
      expect(spokeA.forwards.find(f => f.kind === 'teardown')?.key).toBe(query.key)
    })
  })

  describe('disconnect', () => {
    it('tears down all active operations when a spoke disconnects', () => {
      const { exchange, ops } = makeRecordingExchange()
      const service = new SharedService({ exchange })

      const spokeA = connectSpoke(service, 'A')
      const spokeB = connectSpoke(service, 'B')

      const sub = makeTestOp('subscription')
      spokeA.exchange.executeOperation(serializeOp(sub))
      spokeB.exchange.executeOperation(serializeOp(sub))

      // A disconnects — B still active so no teardown yet
      service.onDisconnectTab('A')
      expect(ops.filter(o => o.kind === 'teardown')).toHaveLength(0)

      // B disconnects — now teardown fires
      service.onDisconnectTab('B')
      expect(ops.filter(o => o.kind === 'teardown')).toHaveLength(1)
    })
  })
})
