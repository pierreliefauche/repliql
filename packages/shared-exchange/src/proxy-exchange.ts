import type { Exchange, Operation, OperationResult } from '@urql/core'
import type { Remote } from 'comlink'
import { proxy, wrap } from 'comlink'
import { empty, fromValue, makeSubject, mergeMap, pipe, publish, subscribe } from 'wonka'

import type { SharedService } from './shared-service'
import type { EndpointConfig, SerializedOperation, SerializedResult } from './types'
import { deserializeOp, deserializeResult, generateId, serializeOp, serializeResult } from './utils'

type ProxySharedExchangeConfig = { sharedService: Remote<SharedService> } | EndpointConfig

/**
 * Creates a Comlink proxy to the hub SharedService from a raw MessagePort.
 * Use when you need to call custom methods on an extended SharedService in addition
 * to using the shared exchange.
 *
 * @example
 * const worker = new SharedWorker('worker.js')
 * const sharedService = proxySharedService({ endpoint: worker.port })
 * sharedService.resetCache()  // custom method on extended SharedService
 */
export function proxySharedService<T extends SharedService = SharedService>(
  config: EndpointConfig,
): Remote<T> {
  return wrap<T>(config.endpoint)
}

/**
 * Creates a URQL exchange that proxies operations through the hub SharedService.
 * Place it in the exchange chain where the shared exchange should sit (e.g. before fetchExchange).
 *
 * Accepts either a raw endpoint or an already-created proxy:
 * - `{ endpoint: worker.port }` — wraps the port in a Comlink proxy automatically
 * - `{ sharedService }` — reuses an existing proxy (e.g. from proxySharedService)
 */
export function proxySharedExchange(config: ProxySharedExchangeConfig): Exchange {
  return ({ client, forward }) => {
    // Prefer an already-created proxy; only wrap the raw port if no proxy is provided.
    const hub: Remote<SharedService> =
      'sharedService' in config ? config.sharedService : wrap(config.endpoint)

    const spokeId = generateId()

    // Maps operation key → Subject used to push hub results into the URQL stream.
    const resultSubjects = new Map<
      number,
      { next: (r: OperationResult) => void; complete: () => void }
    >()

    // Maps operation key → original Operation (for result reconstruction).
    const pendingOps = new Map<number, Operation>()

    // Maps operation key → unsubscribe for an active forward subscription.
    // (The hub asked this spoke's downstream to execute an operation.)
    const forwardSubs = new Map<number, () => void>()

    // Lazily established on the first operation — stored as a promise so concurrent
    // operations don't open multiple connections.
    let connectionPromise: Promise<void> | null = null

    const ensureConnected = (): Promise<void> => {
      if (!connectionPromise) {
        connectionPromise = hub.connect(
          spokeId,
          proxy({
            onResult(result: SerializedResult): void {
              const op = pendingOps.get(result.key)
              if (!op) return
              resultSubjects.get(result.key)?.next(deserializeResult(result, op))
            },

            onForward(serialized: SerializedOperation): void {
              if (serialized.kind === 'teardown') {
                // Hub is signalling us to teardown our downstream subscription for this key
                forwardSubs.get(serialized.key)?.()
                forwardSubs.delete(serialized.key)
                // Push the teardown through forward so downstream exchanges can process it
                // The subscription completes immediately but we explicitly unsubscribe for safety
                const teardownOp = deserializeOp(serialized)
                pipe(fromValue(teardownOp), forward, publish)
                return
              }

              const op = deserializeOp(serialized)
              // Clean up any existing forward subscription for this key before starting a new one
              forwardSubs.get(serialized.key)?.()
              const subscription = pipe(
                fromValue(op),
                forward,
                subscribe((result: OperationResult) => {
                  void hub.resolveForwarded(spokeId, serialized.key, serializeResult(result))
                }),
              )
              forwardSubs.set(serialized.key, () => subscription.unsubscribe())
            },

            onReexecute(serialized: SerializedOperation): void {
              // Hub's exchange asked us to reexecute through our own URQL client
              client.reexecuteOperation(deserializeOp(serialized))
            },
          }),
        ) as Promise<void>
      }
      return connectionPromise
    }

    return ops$ =>
      pipe(
        ops$,
        mergeMap((op: Operation) => {
          if (op.kind === 'teardown') {
            // Complete the result subject and clean up all state for this key
            resultSubjects.get(op.key)?.complete()
            resultSubjects.delete(op.key)
            pendingOps.delete(op.key)
            forwardSubs.get(op.key)?.()
            forwardSubs.delete(op.key)
            void ensureConnected().then(() => hub.teardownOperation(spokeId, op.key))
            return empty
          }

          // If a subject already exists (re-execution of an active op), complete it first
          resultSubjects.get(op.key)?.complete()
          const subject = makeSubject<OperationResult>()
          resultSubjects.set(op.key, {
            next: v => subject.next(v),
            complete: () => subject.complete(),
          })
          pendingOps.set(op.key, op)

          void ensureConnected().then(() => hub.executeOperation(spokeId, serializeOp(op)))
          return subject.source
        }),
      )
  }
}
