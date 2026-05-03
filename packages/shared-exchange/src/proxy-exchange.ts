import { ensureOperationId, getOperationHandle, type OperationHandle } from '@repliql/utils'
import type { Exchange, Operation, OperationResult } from '@urql/core'
import type { Remote } from 'comlink'
import { proxy } from 'comlink'
import { empty, makeSubject, mergeMap, pipe, subscribe } from 'wonka'

import type { SerializedOperation, SerializedResult, SharedExchange } from './types'
import { deserializeOp, deserializeResult, serializeOp, serializeResult } from './utils'

type ProxySharedExchangeConfig = { sharedExchange: Remote<SharedExchange> }

/**
 * Creates a URQL exchange that proxies operations through the hub SharedService.
 * Place it in the exchange chain where the shared exchange should sit (e.g. before fetchExchange).
 *
 * Accepts either a raw endpoint or an already-created proxy:
 * - `{ endpoint: worker.port }` — wraps the port in a Comlink proxy automatically
 * - `{ sharedService }` — reuses an existing proxy (e.g. from proxySharedService)
 */
export function proxySharedExchange({ sharedExchange: hub }: ProxySharedExchangeConfig): Exchange {
  return ({ client, forward }) => {
    // Maps operation handle → Subject used to push hub results into the URQL stream.
    const resultSubjects = new Map<
      OperationHandle,
      { next: (r: OperationResult) => void; complete: () => void }
    >()

    // Maps operation handle → original Operation (for result reconstruction).
    const pendingOps = new Map<OperationHandle, Operation>()

    // Subject for operations the hub asks us to forward to downstream exchanges.
    // Using a subject allows us to call forward() exactly once (at setup time),
    // then push operations into it as they arrive from the hub.
    const forwardedOps = makeSubject<Operation>()

    // Lazily established on the first operation — stored as a promise so concurrent
    // operations don't open multiple connections.
    let connectionPromise: Promise<void> | null = null

    const ensureConnected = async () => {
      if (!connectionPromise) {
        connectionPromise = Promise.resolve()
          .then(async () => {
            // Set up the forward pipeline BEFORE connecting to the hub.
            // This ensures we're ready to receive forwarded operations as soon as onForward is called.
            // Results from forwarded ops are sent back to the hub.
            pipe(
              forwardedOps.source,
              forward,
              subscribe((result: OperationResult) => {
                void hub.resolveForwarded(
                  getOperationHandle(result.operation),
                  serializeResult(result),
                )
              }),
            )

            await hub.register(
              proxy({
                onResult(result: SerializedResult): void {
                  const op = pendingOps.get(result.handle)
                  if (!op) return
                  resultSubjects.get(result.handle)?.next(deserializeResult(result, op))
                },

                onForward(serialized: SerializedOperation): void {
                  // Re-hydrate with non-serializable context from the original operation.
                  // This preserves functions like fetch, fetchOptions while respecting any
                  // modifications the hub made to serializable fields.
                  const originalOp = pendingOps.get(getOperationHandle(serialized))
                  const op = deserializeOp(serialized, originalOp)

                  // Push the operation (including teardowns) through the single forward stream.
                  // This complies with URQL's requirement that forward() is called only once.
                  forwardedOps.next(op)
                },

                onReexecute(serialized: SerializedOperation): void {
                  // Re-hydrate with non-serializable context from the original operation.
                  const originalOp = pendingOps.get(getOperationHandle(serialized))
                  const op = deserializeOp(serialized, originalOp)

                  client.reexecuteOperation(op)
                },
              }),
            )
          })
          .catch(error => {
            connectionPromise = null
            throw error
          })
      }
      return connectionPromise
    }

    return ops$ =>
      pipe(
        ensureOperationId(ops$),
        mergeMap((op: Operation) => {
          const handle = getOperationHandle(op)

          if (op.kind === 'teardown') {
            // Complete the result subject and clean up all state for this key
            resultSubjects.get(handle)?.complete()
            resultSubjects.delete(handle)
            pendingOps.delete(handle)
            void ensureConnected().then(() => hub.teardownOperation(handle))
            return empty
          }

          // If a subject already exists (re-execution of an active op), complete it first
          resultSubjects.get(handle)?.complete()
          const subject = makeSubject<OperationResult>()
          resultSubjects.set(handle, {
            next: v => subject.next(v),
            complete: () => subject.complete(),
          })
          pendingOps.set(handle, op)

          void ensureConnected().then(() => hub.executeOperation(serializeOp(op)))
          return subject.source
        }),
      )
  }
}
