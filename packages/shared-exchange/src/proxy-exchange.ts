import type { Exchange, Operation, OperationResult } from '@urql/core'
import type { Remote } from 'comlink'
import { proxy, wrap } from 'comlink'
import { empty, makeSubject, mergeMap, pipe, subscribe } from 'wonka'

import { heartbeat as navigatorHeartbeat } from './heartbeat'
import type { SharedService } from './shared-service'
import type { EndpointConfig, Heartbeat, SerializedOperation, SerializedResult } from './types'
import { deserializeOp, deserializeResult, generateId, serializeOp, serializeResult } from './utils'

type ProxySharedExchangeConfig = { heartbeat?: Heartbeat } & (
  | { sharedService: Remote<SharedService> }
  | EndpointConfig
)

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
export function proxySharedExchange({
  heartbeat: _heartbeat,
  ...config
}: ProxySharedExchangeConfig): Exchange {
  return ({ client, forward }) => {
    // Default to browser heartbeat
    const heartbeat = _heartbeat || navigatorHeartbeat

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

    // Subject for operations the hub asks us to forward to downstream exchanges.
    // Using a subject allows us to call forward() exactly once (at setup time),
    // then push operations into it as they arrive from the hub.
    const forwardedOps = makeSubject<Operation>()

    // Lazily established on the first operation — stored as a promise so concurrent
    // operations don't open multiple connections.
    let connectionPromise: Promise<void> | null = null

    const ensureConnected = async () => {
      if (!connectionPromise) {
        connectionPromise = Promise.resolve().then(async () => {
        // Set up the forward pipeline BEFORE connecting to the hub.
        // This ensures we're ready to receive forwarded operations as soon as onForward is called.
        // Results from forwarded ops are sent back to the hub.
        pipe(
          forwardedOps.source,
          forward,
          subscribe((result: OperationResult) => {
            void hub.resolveForwarded(spokeId, result.operation.key, serializeResult(result))
          }),
        )

        await heartbeat.start(spokeId)

        await hub.connect(
          spokeId,
          proxy({
            onResult(result: SerializedResult): void {
              const op = pendingOps.get(result.key)
              if (!op) return
              resultSubjects.get(result.key)?.next(deserializeResult(result, op))
            },

            onForward(serialized: SerializedOperation): void {
              // Re-hydrate with non-serializable context from the original operation.
              // This preserves functions like fetch, fetchOptions while respecting any
              // modifications the hub made to serializable fields.
              const originalOp = pendingOps.get(serialized.key)
              const op = deserializeOp(serialized, originalOp)

              // Push the operation (including teardowns) through the single forward stream.
              // This complies with URQL's requirement that forward() is called only once.
              forwardedOps.next(op)
            },

            onReexecute(serialized: SerializedOperation): void {
              // Re-hydrate with non-serializable context from the original operation.
              const originalOp = pendingOps.get(serialized.key)
              const op = deserializeOp(serialized, originalOp)
              client.reexecuteOperation(op)
            },
          }),
        )
        }).catch((error) => {
          connectionPromise = null
          throw error
        })
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
