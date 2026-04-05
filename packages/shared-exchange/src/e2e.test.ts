import { describe, it, expect } from 'bun:test'

import {
  type Client,
  type ExchangeIO,
  type Operation,
  type OperationResult,
  createRequest,
  gql,
  makeOperation,
} from '@urql/core'
import type { Remote } from 'comlink'
import { delay, filter, makeSubject, map, pipe, subscribe } from 'wonka'
import type { Source } from 'wonka'

import { proxySharedExchange } from './proxy-exchange'
import { SharedService } from './shared-service'
import type { SpokeCallbacks } from './types'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const testDoc = gql`
  query TestQuery {
    opKey
    opKind
  }
`
const testCtx = { url: 'http://test.example', requestPolicy: 'cache-first' as const }

function makeTestOp(kind: 'query' | 'mutation' | 'subscription' = 'query'): Operation {
  return makeOperation(kind, createRequest(testDoc, {}), testCtx)
}

/** Flush 2 levels of microtasks (enough for the connect → executeOperation promise chain). */
async function flush(delay?: number): Promise<void> {
  if (delay) {
    await new Promise(resolve => setTimeout(resolve, delay))
  } else {
    await Promise.resolve()
    await Promise.resolve()
  }
}

/**
 * Wraps a real SharedService as a Remote<SharedService> without any MessagePort or Comlink
 * serialization — method calls go directly to the service and return Promise.resolve().
 *
 * comlink's proxy(callbacks) just adds a marker symbol to the object, leaving all methods
 * callable directly, so SpokeCallbacks still work end-to-end through this adapter.
 */
function createDirectHub(service: SharedService): Remote<SharedService> {
  return {
    connect: (id: string, cb: SpokeCallbacks) => Promise.resolve(service.connect(id, cb)),
    disconnect: (id: string) => Promise.resolve(service.disconnect(id)),
    executeOperation: (id: string, op: Parameters<SharedService['executeOperation']>[1]) =>
      Promise.resolve(service.executeOperation(id, op)),
    teardownOperation: (id: string, key: number) =>
      Promise.resolve(service.teardownOperation(id, key)),
    resolveForwarded: (
      id: string,
      key: number,
      result: Parameters<SharedService['resolveForwarded']>[2],
    ) => Promise.resolve(service.resolveForwarded(id, key, result)),
  } as unknown as Remote<SharedService>
}

/**
 * A mock network layer: every operation immediately receives { value: <opKey> }.
 * Used as the `forward` ExchangeIO in spokes to simulate a fetch exchange.
 */
const mockFetch: ExchangeIO = ops$ =>
  pipe(
    ops$,
    filter(op => op.kind !== 'teardown'),
    map(
      (op): OperationResult => ({
        operation: op,
        data: { opKey: op.key, opKind: op.kind },
        stale: false,
        hasNext: false,
      }),
    ),
  ) as Source<OperationResult>

/** Sets up a spoke exchange wired to the given hub and returns test handles. */
function setupSpoke(
  hub: Remote<SharedService>,
  forwardFn: ExchangeIO = mockFetch,
): { opsSubject: ReturnType<typeof makeSubject<Operation>>; results: OperationResult[] } {
  const fakeClient = { reexecuteOperation: () => {} } as unknown as Client
  const exchange = proxySharedExchange({ sharedService: hub })
  const opsSubject = makeSubject<Operation>()
  const results: OperationResult[] = []

  pipe(
    exchange({ client: fakeClient, forward: forwardFn, dispatchDebug: () => {} })(
      opsSubject.source,
    ),
    subscribe(r => results.push(r)),
  )

  return { opsSubject, results }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

/** Hub exchange that passes all operations to forward (simulates 100% cache miss). */
const forwardAllExchange = SharedService.prototype // trick to avoid re-importing; declared inline below
void forwardAllExchange

describe('end-to-end: spoke → hub → forward → hub → spoke', () => {
  it('delivers network result back to the originating spoke', async () => {
    const service = new SharedService({
      exchange:
        ({ forward }) =>
        ops$ =>
          forward(ops$),
    })
    const hub = createDirectHub(service)
    const { opsSubject, results } = setupSpoke(hub)

    const query = makeTestOp('query')
    opsSubject.next(query)
    await flush()

    expect(results).toHaveLength(1)
    expect(results[0]?.data).toEqual({ opKey: query.key, opKind: 'query' })
  })

  it('broadcasts one result to two spokes subscribed to the same query', async () => {
    const service = new SharedService({
      exchange:
        ({ forward }) =>
        ops$ =>
          forward(ops$),
    })
    const hub = createDirectHub(service)
    const spokeA = setupSpoke(hub)
    const spokeB = setupSpoke(hub)

    const query = makeTestOp('query')

    spokeA.opsSubject.next(query)
    await flush()

    expect(spokeA.results).toHaveLength(1)
    expect(spokeA.results[0]?.data).toEqual({ opKey: query.key, opKind: 'query' })
    expect(spokeB.results).toHaveLength(0)

    spokeB.opsSubject.next(query)
    await flush()

    // Each spoke receives its own result (queries are not deduplicated)
    expect(spokeA.results).toHaveLength(2)
    expect(spokeA.results[1]?.data).toEqual({ opKey: query.key, opKind: 'query' })
    expect(spokeB.results).toHaveLength(1)
    expect(spokeB.results[0]?.data).toEqual({ opKey: query.key, opKind: 'query' })
  })

  it('rule #4 — only one forward call for a subscription shared by two spokes', async () => {
    let forwardCallCount = 0
    const countingFetch: ExchangeIO = ops$ =>
      pipe(
        ops$,
        filter(op => op.kind !== 'teardown'),
        delay(10),
        map((op): OperationResult => {
          forwardCallCount++
          return { operation: op, data: { value: op.key }, stale: false, hasNext: false }
        }),
      ) as Source<OperationResult>

    const service = new SharedService({
      exchange:
        ({ forward }) =>
        ops$ =>
          forward(ops$),
    })
    const hub = createDirectHub(service)
    const spokeA = setupSpoke(hub, countingFetch)
    const spokeB = setupSpoke(hub, countingFetch)
    const spokeC = setupSpoke(hub, countingFetch)

    const sub = makeTestOp('subscription')
    spokeA.opsSubject.next(sub)
    await flush(5)
    spokeB.opsSubject.next(sub) // same key — hub deduplicates
    await flush(15)

    // Hub only forwarded once even though two spokes requested it
    expect(forwardCallCount).toBe(1)

    // Both spokes receive the result from that single forward
    expect(spokeA.results).toHaveLength(1)
    expect(spokeB.results).toHaveLength(1)
    expect(spokeC.results).toHaveLength(0)
  })

  it('rule #2 — teardown does not reach forward until all spokes tear down', async () => {
    let teardownCount = 0
    const trackingFetch: ExchangeIO = ops$ =>
      pipe(
        ops$,
        filter(op => {
          if (op.kind === 'teardown') {
            teardownCount++
            return false
          }
          return true
        }),
        map((op: Operation): OperationResult => {
          return { operation: op, data: null, stale: false, hasNext: false }
        }),
      ) as Source<OperationResult>

    const service = new SharedService({
      exchange:
        ({ forward }) =>
        ops$ =>
          forward(ops$),
    })
    const hub = createDirectHub(service)
    const spokeA = setupSpoke(hub, trackingFetch)
    const spokeB = setupSpoke(hub, trackingFetch)

    const op = makeTestOp('query')
    spokeA.opsSubject.next(op)
    spokeB.opsSubject.next(op)
    await flush()

    // Spoke A tears down — B still active, no teardown should propagate
    spokeA.opsSubject.next(makeOperation('teardown', op, testCtx))
    await flush()
    expect(teardownCount).toBe(0)

    // Spoke B tears down — now the teardown propagates
    spokeB.opsSubject.next(makeOperation('teardown', op, testCtx))
    await flush(5)
    expect(teardownCount).toBe(1)
  })

  it('result arrives after a flush — not synchronously', async () => {
    const service = new SharedService({
      exchange:
        ({ forward }) =>
        ops$ =>
          forward(ops$),
    })
    const hub = createDirectHub(service)
    const { opsSubject, results } = setupSpoke(hub)

    const query = makeTestOp('query')
    opsSubject.next(query)

    // Before any microtasks settle the promise chain — no result yet
    expect(results).toHaveLength(0)

    await flush()
    expect(results).toHaveLength(1)
  })
})
