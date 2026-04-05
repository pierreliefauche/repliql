import { describe, it, expect } from 'bun:test'

import {
  type Client,
  createClient,
  type Exchange,
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
import { SharedService as _SharedService, SharedServiceConfig } from './shared-service'
import type { SpokeCallbacks } from './types'

// Mock heartbeat, never stop beating
const mockHeartbeat = {
  start: () => Promise.resolve(),
  onStop: () => {},
}

class SharedService extends _SharedService {
  constructor(config: SharedServiceConfig) {
    super({
      heartbeat: mockHeartbeat,
      ...config,
    })
  }
}

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
async function flush(delay: number = 1): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, delay))
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
  const exchange = proxySharedExchange({ sharedService: hub, heartbeat: mockHeartbeat })
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

/** Creates a mock fetch that tracks calls and can return custom responses */
function createMockFetch(options?: {
  delayMs?: number
  onFetch?: (op: Operation) => void
  getData?: (op: Operation) => unknown
}): ExchangeIO {
  const {
    delayMs = 0,
    onFetch,
    getData = (op: Operation) => ({ opKey: op.key, opKind: op.kind }),
  } = options ?? {}

  return ops$ => {
    let source = pipe(
      ops$,
      filter(op => op.kind !== 'teardown'),
      map((op): OperationResult => {
        onFetch?.(op)
        return {
          operation: op,
          data: getData(op),
          stale: false,
          hasNext: op.kind === 'subscription',
        }
      }),
    ) as Source<OperationResult>

    if (delayMs > 0) {
      source = pipe(source, delay(delayMs))
    }

    return source
  }
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

// ─── E2E Tests with Hub Forwarding to Spokes ─────────────────────────────────
// These tests verify the full flow: spoke → hub → forward → spoke's mockFetch → hub → spoke

describe('e2e with hub forwarding to spoke mock fetch', () => {
  /** Hub exchange that forwards everything (100% cache miss) */
  const forwardAllExchange: Exchange =
    ({ forward }) =>
    (ops$: Source<Operation>) =>
      forward(ops$)

  it('spoke query flows through hub forward to spoke mock fetch and back', async () => {
    const fetchCalls: Operation[] = []
    const mockFetch = createMockFetch({
      onFetch: op => fetchCalls.push(op),
      getData: op => ({ fetched: true, key: op.key }),
    })

    const service = new SharedService({ exchange: forwardAllExchange })
    const hub = createDirectHub(service)
    const { opsSubject, results } = setupSpoke(hub, mockFetch)

    const query = makeTestOp('query')
    opsSubject.next(query)
    await flush()

    // Mock fetch was called by the spoke's forward path
    expect(fetchCalls).toHaveLength(1)
    expect(fetchCalls[0]?.key).toBe(query.key)

    // Result came back through the full chain
    expect(results).toHaveLength(1)
    expect(results[0]?.data).toEqual({ fetched: true, key: query.key })
  })

  it('two spokes share one fetch call for deduplicated subscription', async () => {
    const fetchCalls: Operation[] = []
    const mockFetch = createMockFetch({
      delayMs: 10,
      onFetch: op => fetchCalls.push(op),
    })

    const service = new SharedService({ exchange: forwardAllExchange })
    const hub = createDirectHub(service)

    // Only spokeA handles the forward (it has the mockFetch)
    const spokeA = setupSpoke(hub, mockFetch)
    const spokeB = setupSpoke(hub, mockFetch)

    const sub = makeTestOp('subscription')
    spokeA.opsSubject.next(sub)
    await flush(5)
    spokeB.opsSubject.next(sub) // Same key - deduplicated
    await flush(15)

    // Only ONE fetch call (subscription deduplicated at hub)
    expect(fetchCalls).toHaveLength(1)

    // Both spokes receive the result
    expect(spokeA.results).toHaveLength(1)
    expect(spokeB.results).toHaveLength(1)
  })

  it('subscription handoff: spokeA disconnects, spokeB takes over fetch', async () => {
    const fetchCalls: { spokeId: string; op: Operation }[] = []
    let spokeIdCounter = 0

    const service = new SharedService({ exchange: forwardAllExchange })
    const hub = createDirectHub(service)

    // Create spokes with mock fetches that identify which spoke made the call
    function setupTrackedSpoke(): ReturnType<typeof setupSpoke> & { spokeId: string } {
      const spokeId = `spoke-${spokeIdCounter++}`
      const trackedMockFetch: ExchangeIO = ops$ =>
        pipe(
          ops$,
          filter(op => op.kind !== 'teardown'),
          map((op): OperationResult => {
            fetchCalls.push({ spokeId, op })
            return {
              operation: op,
              data: { from: spokeId },
              stale: false,
              hasNext: true,
            }
          }),
        ) as Source<OperationResult>

      return { ...setupSpoke(hub, trackedMockFetch), spokeId }
    }

    const spokeA = setupTrackedSpoke()
    const spokeB = setupTrackedSpoke()

    const sub = makeTestOp('subscription')

    // A subscribes first - it handles the forward
    spokeA.opsSubject.next(sub)
    await flush()

    expect(fetchCalls).toHaveLength(1)
    expect(fetchCalls[0]?.spokeId).toBe('spoke-0') // A fetched

    // B joins the subscription (deduplicated)
    spokeB.opsSubject.next(sub)
    await flush()

    expect(fetchCalls).toHaveLength(1) // Still just one fetch

    // A tears down - B should take over
    spokeA.opsSubject.next(makeOperation('teardown', sub, testCtx))
    await flush()

    // B now handles the forward
    expect(fetchCalls).toHaveLength(2)
    expect(fetchCalls[1]?.spokeId).toBe('spoke-1') // B took over

    // B gets result from its own fetch
    expect(spokeB.results.length).toBeGreaterThanOrEqual(1)
  })

  it('multiple queries from different spokes each trigger their own fetch', async () => {
    const fetchCalls: Operation[] = []
    const mockFetch = createMockFetch({
      onFetch: op => fetchCalls.push(op),
    })

    const service = new SharedService({ exchange: forwardAllExchange })
    const hub = createDirectHub(service)

    const spokeA = setupSpoke(hub, mockFetch)
    const spokeB = setupSpoke(hub, mockFetch)

    const query = makeTestOp('query')

    spokeA.opsSubject.next(query)
    await flush()

    spokeB.opsSubject.next(query) // Same query from different spoke
    await flush()

    // Queries are NOT deduplicated - each spoke triggers a fetch
    expect(fetchCalls).toHaveLength(2)

    expect(spokeA.results).toHaveLength(2) // A receives both results (it's the owner)
    expect(spokeB.results).toHaveLength(1) // B receives its own result
  })

  it('teardown propagates through forward path and reaches mock fetch', async () => {
    const teardownCalls: Operation[] = []
    const mockFetchWithTeardown: ExchangeIO = ops$ =>
      pipe(
        ops$,
        filter(op => {
          if (op.kind === 'teardown') {
            teardownCalls.push(op)
            return false
          }
          return true
        }),
        map(
          (op): OperationResult => ({
            operation: op,
            data: { value: op.key },
            stale: false,
            hasNext: false,
          }),
        ),
      ) as Source<OperationResult>

    const service = new SharedService({ exchange: forwardAllExchange })
    const hub = createDirectHub(service)
    const { opsSubject, results } = setupSpoke(hub, mockFetchWithTeardown)

    const query = makeTestOp('query')
    opsSubject.next(query)
    await flush()

    expect(results).toHaveLength(1)

    // Teardown the query
    opsSubject.next(makeOperation('teardown', query, testCtx))
    await flush()

    // Teardown reached the mock fetch
    expect(teardownCalls).toHaveLength(1)
    expect(teardownCalls[0]?.key).toBe(query.key)
  })

  it('slow fetch: result arrives after delay, both spokes receive it', async () => {
    const mockFetch = createMockFetch({
      delayMs: 50,
      getData: () => ({ delayed: true }),
    })

    const service = new SharedService({ exchange: forwardAllExchange })
    const hub = createDirectHub(service)

    const spokeA = setupSpoke(hub, mockFetch)
    const spokeB = setupSpoke(hub, mockFetch)

    const sub = makeTestOp('subscription')

    spokeA.opsSubject.next(sub)
    spokeB.opsSubject.next(sub)
    await flush()

    // No results yet (fetch is slow)
    expect(spokeA.results).toHaveLength(0)
    expect(spokeB.results).toHaveLength(0)

    // Wait for the delayed fetch
    await flush(60)

    // Both receive the result
    expect(spokeA.results).toHaveLength(1)
    expect(spokeB.results).toHaveLength(1)
    expect(spokeA.results[0]?.data).toEqual({ delayed: true })
    expect(spokeB.results[0]?.data).toEqual({ delayed: true })
  })
})

// ─── Real URQL Client E2E Tests with Mock Fetch ──────────────────────────────
// These tests use actual URQL createClient with proxySharedExchange + mockFetchExchange.
// The mockFetchExchange handles operations forwarded from the hub via onForward.

describe('e2e with real URQL clients and mock fetch exchange', () => {
  /** Hub exchange that forwards everything (100% cache miss) */
  const forwardAllExchange: Exchange =
    ({ forward }) =>
    ops$ =>
      forward(ops$)

  /** Creates a mock fetch exchange that tracks calls and returns custom data */
  function createMockFetchExchange(options?: {
    onFetch?: (op: Operation) => void
    getData?: (op: Operation) => unknown
    delayMs?: number
  }): Exchange {
    const {
      onFetch,
      getData = (op: Operation) => ({ opKey: op.key, opKind: op.kind }),
      delayMs = 0,
    } = options ?? {}

    return () => ops$ => {
      let source = pipe(
        ops$,
        filter(op => op.kind !== 'teardown'),
        map((op): OperationResult => {
          onFetch?.(op)
          return {
            operation: op,
            data: getData(op),
            stale: false,
            hasNext: op.kind === 'subscription',
          }
        }),
      ) as Source<OperationResult>

      if (delayMs > 0) {
        source = pipe(source, delay(delayMs))
      }

      return source
    }
  }

  /**
   * Creates a real URQL client with proxySharedExchange + mockFetchExchange.
   * The mockFetchExchange handles operations forwarded from the hub.
   */
  function createUrqlClient(
    hub: Remote<SharedService>,
    fetchOptions?: Parameters<typeof createMockFetchExchange>[0],
  ): Client {
    return createClient({
      url: 'http://test.example/graphql',
      exchanges: [
        proxySharedExchange({ sharedService: hub, heartbeat: mockHeartbeat }),
        createMockFetchExchange(fetchOptions),
      ],
    })
  }

  it('urql client.query() flows through hub forward to client mock fetch', async () => {
    const fetchCalls: Operation[] = []

    const service = new SharedService({ exchange: forwardAllExchange })
    const hub = createDirectHub(service)

    const client = createUrqlClient(hub, {
      onFetch: op => fetchCalls.push(op),
      getData: op => ({ fromMockFetch: true, key: op.key }),
    })

    const result = await client.query(testDoc, {}).toPromise()

    // The client's mock fetch exchange handled the forwarded request
    expect(fetchCalls).toHaveLength(1)

    // Result came back through the full chain
    expect(result.data).toBeDefined()
    expect(result.data?.fromMockFetch).toBe(true)
  })

  it('two urql clients: first handles forward, both receive results', async () => {
    const fetchCalls: Operation[] = []
    const subDoc = gql`
      subscription TestSub {
        value
      }
    `

    const service = new SharedService({ exchange: forwardAllExchange })
    const hub = createDirectHub(service)

    // ClientA will handle the forward (first to subscribe)
    const clientA = createUrqlClient(hub, {
      delayMs: 10,
      onFetch: op => fetchCalls.push(op),
      getData: () => ({ subscriptionData: true }),
    })
    const clientB = createUrqlClient(hub, {
      delayMs: 10,
      onFetch: op => fetchCalls.push(op),
      getData: () => ({ subscriptionData: true }),
    })

    const resultsA: OperationResult[] = []
    const resultsB: OperationResult[] = []

    // A subscribes first (becomes forward handler)
    const subA = pipe(
      clientA.subscription(subDoc, {}),
      subscribe(r => resultsA.push(r)),
    )
    await flush(5)

    // B joins (deduplicated)
    const subB = pipe(
      clientB.subscription(subDoc, {}),
      subscribe(r => resultsB.push(r)),
    )
    await flush(20)

    // Only ONE fetch call (A handled the forward, subscription deduplicated at hub)
    expect(fetchCalls).toHaveLength(1)

    // Both clients receive the result
    expect(resultsA).toHaveLength(1)
    expect(resultsB).toHaveLength(1)
    expect(resultsA[0]?.data?.subscriptionData).toBe(true)
    expect(resultsB[0]?.data?.subscriptionData).toBe(true)

    subA.unsubscribe()
    subB.unsubscribe()
  })

  it('urql client unsubscribe triggers teardown through hub', async () => {
    const teardownCalls: Operation[] = []

    const service = new SharedService({ exchange: forwardAllExchange })
    const hub = createDirectHub(service)

    // Track teardowns in the mock fetch exchange
    const trackingFetchExchange: Exchange = () => ops$ =>
      pipe(
        ops$,
        filter(op => {
          if (op.kind === 'teardown') {
            teardownCalls.push(op)
            return false
          }
          return true
        }),
        map(
          (op): OperationResult => ({
            operation: op,
            data: { value: op.key },
            stale: false,
            hasNext: false,
          }),
        ),
      ) as Source<OperationResult>

    const client = createClient({
      url: 'http://test.example/graphql',
      exchanges: [
        proxySharedExchange({ sharedService: hub, heartbeat: mockHeartbeat }),
        trackingFetchExchange,
      ],
    })

    const results: OperationResult[] = []
    const sub = pipe(
      client.query(testDoc, {}),
      subscribe(r => results.push(r)),
    )
    await flush()

    expect(results).toHaveLength(1)

    // Unsubscribe should trigger teardown
    sub.unsubscribe()
    await flush()

    expect(teardownCalls).toHaveLength(1)
  })

  it('multiple urql clients with separate queries each handle their own forward', async () => {
    const fetchCallsA: Operation[] = []
    const fetchCallsB: Operation[] = []

    const service = new SharedService({ exchange: forwardAllExchange })
    const hub = createDirectHub(service)

    const clientA = createUrqlClient(hub, { onFetch: op => fetchCallsA.push(op) })
    const clientB = createUrqlClient(hub, { onFetch: op => fetchCallsB.push(op) })

    // Both clients query (queries are NOT deduplicated)
    const [resultA, resultB] = await Promise.all([
      clientA.query(testDoc, {}).toPromise(),
      clientB.query(testDoc, {}).toPromise(),
    ])

    // Each client handled its own forward
    expect(fetchCallsA.length + fetchCallsB.length).toBe(2)

    expect(resultA.data).toBeDefined()
    expect(resultB.data).toBeDefined()
  })

  it('urql client receives delayed results', async () => {
    const service = new SharedService({ exchange: forwardAllExchange })
    const hub = createDirectHub(service)

    const client = createUrqlClient(hub, {
      delayMs: 30,
      getData: () => ({ delayed: true }),
    })

    const startTime = Date.now()
    const result = await client.query(testDoc, {}).toPromise()
    const elapsed = Date.now() - startTime

    // Result should have been delayed
    expect(elapsed).toBeGreaterThanOrEqual(25)
    expect(result.data?.delayed).toBe(true)
  })

  it('subscription handoff: clientA unsubscribes, clientB takes over forwarding', async () => {
    const subDoc = gql`
      subscription HandoffTest {
        count
      }
    `
    const fetchCallsA: Operation[] = []
    const fetchCallsB: Operation[] = []

    const service = new SharedService({ exchange: forwardAllExchange })
    const hub = createDirectHub(service)

    // Use delay so B can subscribe before A's result arrives
    const clientA = createUrqlClient(hub, {
      delayMs: 15,
      onFetch: op => fetchCallsA.push(op),
      getData: () => ({ from: 'A' }),
    })
    const clientB = createUrqlClient(hub, {
      delayMs: 15,
      onFetch: op => fetchCallsB.push(op),
      getData: () => ({ from: 'B' }),
    })

    const resultsA: OperationResult[] = []
    const resultsB: OperationResult[] = []

    // A subscribes first (handles forward)
    const subA = pipe(
      clientA.subscription(subDoc, {}),
      subscribe(r => resultsA.push(r)),
    )
    await flush(5) // Wait a bit but not long enough for result

    expect(fetchCallsA).toHaveLength(1)
    expect(fetchCallsB).toHaveLength(0)

    // B joins (deduplicated) before A's delayed result arrives
    const subB = pipe(
      clientB.subscription(subDoc, {}),
      subscribe(r => resultsB.push(r)),
    )
    await flush(20) // Now wait for the delayed result

    // Both received the result from A's fetch
    expect(resultsA).toHaveLength(1)
    expect(resultsB).toHaveLength(1)

    // A unsubscribes - B should take over forwarding
    subA.unsubscribe()
    await flush(20) // Wait for handoff and B's fetch result

    // Handoff: B's mock fetch now handles the subscription
    expect(fetchCallsB).toHaveLength(1)

    // B receives the new result from its own fetch
    expect(resultsB.length).toBeGreaterThanOrEqual(2)

    subB.unsubscribe()
  })

  it('streaming subscription: client receives multiple results', async () => {
    const subDoc = gql`
      subscription StreamTest {
        value
      }
    `
    const resultSubject = makeSubject<OperationResult>()

    // Streaming mock fetch exchange
    const streamingFetchExchange: Exchange = () => ops$ =>
      pipe(
        ops$,
        filter(op => op.kind !== 'teardown'),
        map((op): Source<OperationResult> => {
          return pipe(
            resultSubject.source,
            map(
              (partial): OperationResult => ({
                ...partial,
                operation: op,
              }),
            ),
          )
        }),
        // Flatten
        (source: Source<Source<OperationResult>>) => {
          const { source: out, next } = makeSubject<OperationResult>()
          pipe(
            source,
            subscribe(inner => {
              pipe(inner, subscribe(next))
            }),
          )
          return out
        },
      )

    const service = new SharedService({ exchange: forwardAllExchange })
    const hub = createDirectHub(service)

    const client = createClient({
      url: 'http://test.example/graphql',
      exchanges: [
        proxySharedExchange({ sharedService: hub, heartbeat: mockHeartbeat }),
        streamingFetchExchange,
      ],
    })

    const results: OperationResult[] = []
    const sub = pipe(
      client.subscription(subDoc, {}),
      subscribe(r => results.push(r)),
    )
    await flush()

    // Push results through the stream
    resultSubject.next({ data: { value: 'first' }, stale: false, hasNext: true } as OperationResult)
    await flush()

    resultSubject.next({
      data: { value: 'second' },
      stale: false,
      hasNext: true,
    } as OperationResult)
    await flush()

    // Client should receive both results
    expect(results.filter(r => r.data?.value === 'first')).toHaveLength(1)
    expect(results.filter(r => r.data?.value === 'second')).toHaveLength(1)

    sub.unsubscribe()
  })
})
