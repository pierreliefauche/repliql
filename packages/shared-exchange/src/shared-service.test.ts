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

import { SharedService } from './shared-service'
import type { SerializedOperation, SerializedResult, SpokeCallbacks } from './types'
import { serializeOp } from './utils'

// ─── Fixtures ────────────────────────────────────────────────────────────────

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

      const spokeA = makeMockCallbacks()
      const spokeB = makeMockCallbacks()
      service.connect('A', spokeA.callbacks)
      service.connect('B', spokeB.callbacks)

      const sub = makeTestOp('subscription')
      service.executeOperation('A', serializeOp(sub))
      service.executeOperation('B', serializeOp(sub)) // same key — deduped

      const initialOps = ops.filter(o => o.kind !== 'teardown').length
      expect(initialOps).toBe(1) // one subscription op

      service.teardownOperation('A', sub.key)
      const teardownsAfterA = ops.filter(o => o.kind === 'teardown').length
      expect(teardownsAfterA).toBe(0) // B still active

      service.teardownOperation('B', sub.key)
      const teardownsAfterB = ops.filter(o => o.kind === 'teardown').length
      expect(teardownsAfterB).toBe(1) // now the exchange sees the teardown
    })

    it('forwards teardown immediately when only one spoke was subscribed', () => {
      const { exchange, ops } = makeRecordingExchange()
      const service = new SharedService({ exchange })

      const spokeA = makeMockCallbacks()
      service.connect('A', spokeA.callbacks)

      const query = makeTestOp('query')
      service.executeOperation('A', serializeOp(query))
      service.teardownOperation('A', query.key)

      const teardowns = ops.filter(o => o.kind === 'teardown')
      expect(teardowns).toHaveLength(1)
    })
  })

  describe('rule #4 — subscription deduplication', () => {
    it('sends only one subscription op even when two spokes subscribe to the same key', () => {
      const { exchange, ops } = makeRecordingExchange()
      const service = new SharedService({ exchange })

      const spokeA = makeMockCallbacks()
      const spokeB = makeMockCallbacks()
      service.connect('A', spokeA.callbacks)
      service.connect('B', spokeB.callbacks)

      const sub = makeTestOp('subscription')
      service.executeOperation('A', serializeOp(sub))
      service.executeOperation('B', serializeOp(sub)) // same key

      const subOps = ops.filter(o => o.kind === 'subscription')
      expect(subOps).toHaveLength(1)
    })

    it('does NOT deduplicate queries — each spoke triggers its own execution', () => {
      const { exchange, ops } = makeRecordingExchange()
      const service = new SharedService({ exchange })

      const spokeA = makeMockCallbacks()
      const spokeB = makeMockCallbacks()
      service.connect('A', spokeA.callbacks)
      service.connect('B', spokeB.callbacks)

      const query = makeTestOp('query')
      service.executeOperation('A', serializeOp(query))
      service.executeOperation('B', serializeOp(query)) // same key, not deduped

      const queryOps = ops.filter(o => o.kind === 'query')
      expect(queryOps).toHaveLength(2)
    })
  })

  describe('result broadcasting', () => {
    it('sends results to all spokes subscribed to the operation key', () => {
      const { exchange, pushResult } = makeRecordingExchange()
      const service = new SharedService({ exchange })

      const spokeA = makeMockCallbacks()
      const spokeB = makeMockCallbacks()
      service.connect('A', spokeA.callbacks)
      service.connect('B', spokeB.callbacks)

      const query = makeTestOp('query')
      service.executeOperation('A', serializeOp(query))
      service.executeOperation('B', serializeOp(query))

      pushResult(makeResult(query, { data: { value: 1 } }))

      expect(spokeA.results).toHaveLength(1)
      expect(spokeB.results).toHaveLength(1)
      expect(spokeA.results[0]?.data).toEqual({ value: 1 })
      expect(spokeB.results[0]?.data).toEqual({ value: 1 })
    })

    it('does not send results to spokes that have torn down', () => {
      const { exchange, pushResult } = makeRecordingExchange()
      const service = new SharedService({ exchange })

      const spokeA = makeMockCallbacks()
      const spokeB = makeMockCallbacks()
      service.connect('A', spokeA.callbacks)
      service.connect('B', spokeB.callbacks)

      const query = makeTestOp('query')
      service.executeOperation('A', serializeOp(query))
      service.executeOperation('B', serializeOp(query))

      // A tears down — still waiting for B
      service.teardownOperation('A', query.key)

      pushResult(makeResult(query, { data: { value: 2 } }))

      expect(spokeA.results).toHaveLength(0) // A no longer subscribed
      expect(spokeB.results).toHaveLength(1)
    })
  })

  describe('forward path', () => {
    it('calls onForward on the owner spoke when the exchange calls forward', () => {
      const service = new SharedService({ exchange: forwardAllExchange })

      const spokeA = makeMockCallbacks()
      service.connect('A', spokeA.callbacks)

      const query = makeTestOp('query')
      service.executeOperation('A', serializeOp(query))

      expect(spokeA.forwards).toHaveLength(1)
      expect(spokeA.forwards[0]?.key).toBe(query.key)
    })

    it('resolveForwarded pushes the result back through the exchange and to the spoke', () => {
      const service = new SharedService({ exchange: forwardAllExchange })

      const spokeA = makeMockCallbacks()
      service.connect('A', spokeA.callbacks)

      const query = makeTestOp('query')
      service.executeOperation('A', serializeOp(query))
      expect(spokeA.forwards).toHaveLength(1)

      const fakeResult: SerializedResult = {
        key: query.key,
        data: { value: 99 },
        stale: false,
        hasNext: false,
      }
      service.resolveForwarded('A', query.key, fakeResult)

      expect(spokeA.results).toHaveLength(1)
      expect(spokeA.results[0]?.data).toEqual({ value: 99 })
    })

    it('forwards teardown to the spoke that triggered it (last unsubscriber), not the original forwarding spoke', () => {
      const service = new SharedService({ exchange: forwardAllExchange })

      const spokeA = makeMockCallbacks()
      const spokeB = makeMockCallbacks()
      service.connect('A', spokeA.callbacks)
      service.connect('B', spokeB.callbacks)

      const sub = makeTestOp('subscription')
      // A subscribes first (becomes the forward handler)
      service.executeOperation('A', serializeOp(sub))
      // B subscribes to same key
      service.executeOperation('B', serializeOp(sub))

      // Only A should receive the initial forward (it's the owner)
      expect(spokeA.forwards.filter(f => f.kind === 'subscription')).toHaveLength(1)
      expect(spokeB.forwards.filter(f => f.kind === 'subscription')).toHaveLength(0)

      // A tears down first (B still active) — subscription hands off to B
      service.teardownOperation('A', sub.key)
      // A gets teardown to stop its forward, B gets subscription to take over
      expect(spokeA.forwards.filter(f => f.kind === 'teardown')).toHaveLength(1)
      expect(spokeB.forwards.filter(f => f.kind === 'subscription')).toHaveLength(1)

      // B tears down last, triggering the full teardown
      service.teardownOperation('B', sub.key)

      // B should receive one more teardown (the final one)
      expect(spokeA.forwards.filter(f => f.kind === 'teardown')).toHaveLength(1) // still just the handoff teardown
      expect(spokeB.forwards.filter(f => f.kind === 'teardown')).toHaveLength(1) // the final teardown
      expect(spokeB.forwards.find(f => f.kind === 'teardown')?.key).toBe(sub.key)
    })

    it('hands off subscription to another spoke when the forwarding spoke disconnects', () => {
      const service = new SharedService({ exchange: forwardAllExchange })

      const spokeA = makeMockCallbacks()
      const spokeB = makeMockCallbacks()
      const spokeC = makeMockCallbacks()
      service.connect('A', spokeA.callbacks)
      service.connect('B', spokeB.callbacks)
      service.connect('C', spokeC.callbacks)

      const sub = makeTestOp('subscription')
      // All three subscribe to the same subscription
      service.executeOperation('A', serializeOp(sub))
      service.executeOperation('B', serializeOp(sub))
      service.executeOperation('C', serializeOp(sub))

      // Only A (first subscriber) receives the forward
      expect(spokeA.forwards.filter(f => f.kind === 'subscription')).toHaveLength(1)
      expect(spokeB.forwards.filter(f => f.kind === 'subscription')).toHaveLength(0)
      expect(spokeC.forwards.filter(f => f.kind === 'subscription')).toHaveLength(0)

      // A disconnects — subscription should hand off to B (next in line)
      service.disconnect('A')
      expect(spokeA.forwards.filter(f => f.kind === 'teardown')).toHaveLength(1) // A's forward is torn down
      expect(spokeB.forwards.filter(f => f.kind === 'subscription')).toHaveLength(1) // B takes over
      expect(spokeC.forwards.filter(f => f.kind === 'subscription')).toHaveLength(0) // C still just listening

      // B disconnects — subscription should hand off to C
      service.disconnect('B')
      expect(spokeB.forwards.filter(f => f.kind === 'teardown')).toHaveLength(1) // B's forward is torn down
      expect(spokeC.forwards.filter(f => f.kind === 'subscription')).toHaveLength(1) // C takes over

      // C disconnects — final teardown
      service.disconnect('C')
      expect(spokeC.forwards.filter(f => f.kind === 'teardown')).toHaveLength(1) // C gets final teardown
    })

    it('forwards teardown to the only spoke when it tears down', () => {
      const service = new SharedService({ exchange: forwardAllExchange })

      const spokeA = makeMockCallbacks()
      service.connect('A', spokeA.callbacks)

      const query = makeTestOp('query')
      service.executeOperation('A', serializeOp(query))

      // A receives the forward
      expect(spokeA.forwards.filter(f => f.kind === 'query')).toHaveLength(1)

      // A tears down
      service.teardownOperation('A', query.key)

      // A should receive the teardown forward since it's the only/triggering spoke
      expect(spokeA.forwards.filter(f => f.kind === 'teardown')).toHaveLength(1)
      expect(spokeA.forwards.find(f => f.kind === 'teardown')?.key).toBe(query.key)
    })
  })

  describe('disconnect', () => {
    it('tears down all active operations when a spoke disconnects', () => {
      const { exchange, ops } = makeRecordingExchange()
      const service = new SharedService({ exchange })

      const spokeA = makeMockCallbacks()
      const spokeB = makeMockCallbacks()
      service.connect('A', spokeA.callbacks)
      service.connect('B', spokeB.callbacks)

      const sub = makeTestOp('subscription')
      service.executeOperation('A', serializeOp(sub))
      service.executeOperation('B', serializeOp(sub))

      // A disconnects — B still active so no teardown yet
      service.disconnect('A')
      expect(ops.filter(o => o.kind === 'teardown')).toHaveLength(0)

      // B disconnects — now teardown fires
      service.disconnect('B')
      expect(ops.filter(o => o.kind === 'teardown')).toHaveLength(1)
    })
  })
})
