import { describe, it, expect } from 'bun:test'

import {
  type Client,
  type Exchange,
  type Operation,
  type OperationResult,
  createRequest,
  gql,
  makeOperation,
} from '@urql/core'
import type { Remote } from 'comlink'
import { makeSubject, pipe, subscribe } from 'wonka'
import type { Source } from 'wonka'

import { proxySharedExchange } from './proxy-exchange'
import type { SharedService } from './shared-service'
import type { SerializedOperation, SerializedResult, SpokeCallbacks } from './types'

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

/** Flush pending microtasks (enough for 2-level promise chains). */
async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

interface MockHub {
  storedCallbacks: SpokeCallbacks | null
  executedOps: SerializedOperation[]
  teardowns: number[]
  forwardedResults: Array<{ key: number; result: SerializedResult }>
  hub: Remote<SharedService>
}

function makeMockHub(): MockHub {
  const mock: MockHub = {
    storedCallbacks: null,
    executedOps: [],
    teardowns: [],
    forwardedResults: [],
    hub: null as unknown as Remote<SharedService>,
  }

  mock.hub = {
    connect(_spokeId: string, callbacks: SpokeCallbacks): Promise<void> {
      mock.storedCallbacks = callbacks
      return Promise.resolve()
    },
    executeOperation(_spokeId: string, op: SerializedOperation): Promise<void> {
      mock.executedOps.push(op)
      return Promise.resolve()
    },
    teardownOperation(_spokeId: string, key: number): Promise<void> {
      mock.teardowns.push(key)
      return Promise.resolve()
    },
    resolveForwarded(_spokeId: string, key: number, result: SerializedResult): Promise<void> {
      mock.forwardedResults.push({ key, result })
      return Promise.resolve()
    },
    disconnect(_spokeId: string): Promise<void> {
      return Promise.resolve()
    },
  } as unknown as Remote<SharedService>

  return mock
}

/** Sets up a proxySharedExchange with a mock hub and returns test handles. */
function setupExchange(
  mockHub: MockHub,
  forwardFn?: (ops$: Source<Operation>) => Source<OperationResult>,
): {
  opsSubject: ReturnType<typeof makeSubject<Operation>>
  results: OperationResult[]
} {
  const exchange: Exchange = proxySharedExchange({ sharedService: mockHub.hub })

  const fakeClient = {
    reexecuteOperation: () => {},
  } as unknown as Client

  const defaultForward = (ops$: Source<Operation>) => ops$ as unknown as Source<OperationResult>

  const exchangeIO = exchange({
    client: fakeClient,
    forward: forwardFn ?? defaultForward,
    dispatchDebug: () => {},
  })

  const opsSubject = makeSubject<Operation>()
  const results: OperationResult[] = []
  pipe(
    exchangeIO(opsSubject.source),
    subscribe(r => results.push(r)),
  )

  return { opsSubject, results }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('proxySharedExchange', () => {
  it('calls hub.executeOperation when an operation arrives', async () => {
    const mock = makeMockHub()
    const { opsSubject } = setupExchange(mock)

    const query = makeTestOp('query')
    opsSubject.next(query)
    await flush()

    expect(mock.executedOps).toHaveLength(1)
    expect(mock.executedOps[0]?.key).toBe(query.key)
    expect(mock.executedOps[0]?.kind).toBe('query')
  })

  it('calls hub.teardownOperation when a teardown op arrives', async () => {
    const mock = makeMockHub()
    const { opsSubject } = setupExchange(mock)

    const query = makeTestOp('query')
    opsSubject.next(query) // start
    await flush()

    opsSubject.next(makeOperation('teardown', query, testCtx)) // teardown
    await flush()

    expect(mock.teardowns).toContain(query.key)
  })

  it('delivers hub results to the URQL result stream', async () => {
    const mock = makeMockHub()
    const { opsSubject, results } = setupExchange(mock)

    const query = makeTestOp('query')
    opsSubject.next(query)
    await flush()

    // Hub sends a result via onResult callback
    mock.storedCallbacks?.onResult({
      key: query.key,
      data: { value: 42 },
      stale: false,
      hasNext: false,
    })

    expect(results).toHaveLength(1)
    expect(results[0]?.data).toEqual({ value: 42 })
  })

  it('runs op through forward when hub calls onForward, then calls resolveForwarded', async () => {
    const mock = makeMockHub()

    const forwardResults = makeSubject<OperationResult>()
    const forwardedOps: Operation[] = []

    const testForward = (ops$: Source<Operation>): Source<OperationResult> => {
      pipe(
        ops$,
        subscribe(op => forwardedOps.push(op)),
      )
      return forwardResults.source
    }

    const { opsSubject } = setupExchange(mock, testForward)

    const query = makeTestOp('query')
    opsSubject.next(query)
    await flush()

    // Hub asks us to forward the operation
    expect(mock.storedCallbacks).not.toBeNull()
    mock.storedCallbacks?.onForward({
      key: query.key,
      kind: 'query',
      query: testDoc,
      url: testCtx.url,
      requestPolicy: testCtx.requestPolicy,
    })

    expect(forwardedOps).toHaveLength(1)
    expect(forwardedOps[0]?.key).toBe(query.key)

    // Simulate forward producing a result
    forwardResults.next({
      operation: query,
      data: { value: 7 },
      stale: false,
      hasNext: false,
    })

    await flush()
    expect(mock.forwardedResults).toHaveLength(1)
    expect(mock.forwardedResults[0]?.result.data).toEqual({ value: 7 })
  })

  it('calls client.reexecuteOperation when hub calls onReexecute', async () => {
    const mock = makeMockHub()

    const reexecuted: Operation[] = []
    const fakeClient = {
      reexecuteOperation: (op: Operation) => reexecuted.push(op),
    } as unknown as Client

    const exchange: Exchange = proxySharedExchange({ sharedService: mock.hub })
    const opsSubject = makeSubject<Operation>()
    // Must subscribe to the result source to activate the Wonka pipeline
    pipe(
      exchange({
        client: fakeClient,
        forward: ops$ => ops$ as unknown as Source<OperationResult>,
        dispatchDebug: () => {},
      })(opsSubject.source),
      subscribe(() => {}),
    )

    const query = makeTestOp('query')
    opsSubject.next(query)
    await flush()

    mock.storedCallbacks?.onReexecute({
      key: query.key,
      kind: 'query',
      query: testDoc,
      url: testCtx.url,
      requestPolicy: testCtx.requestPolicy,
    })

    expect(reexecuted).toHaveLength(1)
    expect(reexecuted[0]?.key).toBe(query.key)
  })

  it('teardown cleans up forward subscriptions', async () => {
    const mock = makeMockHub()
    const forwardedOps: Operation[] = []

    const testForward = (ops$: Source<Operation>): Source<OperationResult> => {
      pipe(
        ops$,
        subscribe(op => forwardedOps.push(op)),
      )
      return makeSubject<OperationResult>().source
    }

    const { opsSubject } = setupExchange(mock, testForward)

    const query = makeTestOp('query')
    opsSubject.next(query)
    await flush()

    // Hub sends a teardown forward signal
    mock.storedCallbacks?.onForward({
      key: query.key,
      kind: 'teardown',
      query: testDoc,
      url: testCtx.url,
      requestPolicy: testCtx.requestPolicy,
    })

    // Teardown the operation
    opsSubject.next(makeOperation('teardown', query, testCtx))
    await flush()

    expect(mock.teardowns).toContain(query.key)
  })
})
