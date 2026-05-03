import type { SharedService } from '@repliql/shared-service/shared'
import { type OperationHandle, getOperationHandle } from '@repliql/utils'
import type { Client, Exchange, ExchangeIO, Operation, OperationResult } from '@urql/core'
import { makeSubject, pipe, publish, subscribe, tap } from 'wonka'

import type { SerializedOperation, SerializedResult, SharedExchange, SpokeCallbacks } from './types'
import { deserializeOp, deserializeResult, serializeOp, serializeResult } from './utils'

export interface SharedExchangeServiceConfig {
  exchange: Exchange
}

interface SpokeState {
  id: string
  callbacks: SpokeCallbacks
  /** Operation handles currently active from this spoke. */
  ops: Set<OperationHandle>
}

export class SharedExchangeService implements SharedService<SharedExchange> {
  /** The wrapped exchange. Assignable to allow hot-swapping (re-execution semantics: TODO). */
  exchange: Exchange

  private readonly spokes: Map<string, SpokeState>
  /** Maps operation handle → set of spoke IDs subscribed to it. */
  private readonly operationSubscribers: Map<OperationHandle, Set<string>>
  /** Maps operation handle → the spoke ID currently handling the forward for it. */
  private readonly forwardingSpokes: Map<OperationHandle, string>
  /** Maps operation handle → the spoke ID that triggered the full teardown (last unsubscriber). */
  private readonly teardownTriggeredBy: Map<OperationHandle, string>
  /** Operation handles whose ops are currently live in the exchange pipeline. */
  private readonly activeOperationHandles: Set<OperationHandle>
  /**
   * Maps operation handle → push function that injects a spoke's forward response back into
   * the hub's forward result stream. Populated in _createForward when onForward fires;
   * consumed by resolveForwarded.
   */
  private readonly pendingForwards: Map<OperationHandle, (r: SerializedResult) => void>
  /** Stores the deserialized Operation per handle for teardown creation. */
  private readonly operationsByHandle: Map<OperationHandle, Operation>
  private readonly operationSubject: ReturnType<typeof makeSubject<Operation>>
  private readonly fakeClient: Client

  constructor({ exchange }: SharedExchangeServiceConfig) {
    this.exchange = exchange
    this.spokes = new Map()
    this.operationSubscribers = new Map()
    this.forwardingSpokes = new Map()
    this.teardownTriggeredBy = new Map()
    this.activeOperationHandles = new Set()
    this.pendingForwards = new Map()
    this.operationsByHandle = new Map()
    this.operationSubject = makeSubject<Operation>()
    this.fakeClient = this._makeFakeClient()
    this._initExchange()
  }

  public onConnectTab(spokeId: string): SharedExchange {
    return {
      register: callbacks => {
        this.spokes.set(spokeId, { id: spokeId, callbacks, ops: new Set() })
      },
      executeOperation: serialized => {
        return this.executeOperation(spokeId, serialized)
      },
      teardownOperation: handle => {
        return this.teardownOperation(spokeId, handle)
      },
      resolveForwarded: (handle, result) => {
        return this.resolveForwarded(spokeId, handle, result)
      },
    }
  }

  public onDisconnectTab(spokeId: string) {
    const spoke = this.spokes.get(spokeId)
    if (!spoke) return
    for (const handle of [...spoke.ops]) {
      this.teardownOperation(spokeId, handle)
    }
    this.spokes.delete(spokeId)
  }

  private getFallbackSpoke(): SpokeState | undefined {
    return this.spokes.values().next().value
  }

  /**
   * Called by a spoke to push an operation into the shared exchange pipeline.
   * Subscriptions are deduplicated: if the same key is already active, the spoke
   * is registered as a subscriber and will receive future results via broadcast.
   * Queries and mutations always execute separately (not deduplicated).
   */
  private executeOperation(spokeId: string, serialized: SerializedOperation): void {
    const op = deserializeOp(serialized)
    const handle = getOperationHandle(op)

    if (!this.operationsByHandle.has(handle)) {
      this.operationsByHandle.set(handle, op)
    }

    let subscribers = this.operationSubscribers.get(handle)
    if (!subscribers) {
      subscribers = new Set()
      this.operationSubscribers.set(handle, subscribers)
    }
    subscribers.add(spokeId)
    this.spokes.get(spokeId)?.ops.add(handle)

    // Rule #4: only deduplicate subscriptions. Queries and mutations always execute.
    // A new spoke joining an active subscription receives future results via _broadcastResult.
    if (op.kind !== 'subscription' || !this.activeOperationHandles.has(handle)) {
      this.activeOperationHandles.add(handle)
      this.operationSubject.next(op)
    }
  }

  /**
   * Called by a spoke to signal it is done with an operation.
   * Rule #2: the actual teardown is only forwarded to the exchange once ALL spokes
   * subscribed to that key have called teardown. The spoke that triggered the full
   * teardown (the last unsubscriber) is recorded so teardown can be forwarded to it.
   *
   * For subscriptions: if the spoke being torn down was handling the forward and other
   * spokes are still subscribed, the subscription is handed off to another spoke.
   */
  private teardownOperation(spokeId: string, handle: OperationHandle): void {
    const subscribers = this.operationSubscribers.get(handle)
    subscribers?.delete(spokeId)
    this.spokes.get(spokeId)?.ops.delete(handle)

    const op = this.operationsByHandle.get(handle)
    const forwardingSpokeId = this.forwardingSpokes.get(handle)

    // If the forwarding spoke is leaving but others remain, hand off the subscription
    if (spokeId === forwardingSpokeId && subscribers?.size && op?.kind === 'subscription') {
      // Tell the old spoke to teardown its forward subscription
      const oldSpoke = this.spokes.get(spokeId)
      if (oldSpoke) {
        void oldSpoke.callbacks.onForward(serializeOp({ ...op, kind: 'teardown' }))
      }

      // Hand off to a new spoke
      const newSpokeId = this._getOwnerSpoke(handle)
      const newSpoke = newSpokeId && this.spokes.get(newSpokeId)
      if (newSpoke) {
        this.forwardingSpokes.set(handle, newSpoke.id)
        void newSpoke.callbacks.onForward(serializeOp(op))
      }
      return
    }

    if (!subscribers?.size) {
      this.operationsByHandle.delete(handle)
      this.operationSubscribers.delete(handle)
      this.activeOperationHandles.delete(handle)
      this.pendingForwards.delete(handle)
      this.forwardingSpokes.delete(handle)
      // Track that this spoke triggered the full teardown
      this.teardownTriggeredBy.set(handle, spokeId)

      if (op) {
        this.operationSubject.next({ ...op, kind: 'teardown' })
      }
    }
  }

  /**
   * Called by a spoke when its downstream exchanges have produced a result for an
   * operation the hub forwarded via onForward. Injects the result into the hub's
   * forward stream so the wrapped exchange (e.g. cacheExchange) can process it.
   */
  private resolveForwarded(
    _spokeId: string,
    handle: OperationHandle,
    result: SerializedResult,
  ): void {
    this.pendingForwards.get(handle)?.(result)
  }

  private _makeFakeClient(): Client {
    // When the wrapped exchange calls reexecuteOperation (e.g. cacheExchange invalidating
    // a cached key), delegate back to the origin spoke's URQL client so the spoke's full
    // exchange chain handles the re-fetch — not the hub in isolation.
    const reexecuteOperation: Client['reexecuteOperation'] = op => {
      const ownerId = this._getOwnerSpoke(getOperationHandle(op))
      const spoke = (ownerId && this.spokes.get(ownerId)) || this.getFallbackSpoke()

      if (spoke) {
        void spoke.callbacks.onReexecute(serializeOp(op))
      }
    }

    return {
      reexecuteOperation,
    } as unknown as Client
  }

  private _initExchange(): void {
    const exchangeIO: ExchangeIO = this.exchange({
      client: this.fakeClient,
      forward: this._createForward(),
      dispatchDebug: () => {},
    })

    pipe(
      exchangeIO(this.operationSubject.source),
      subscribe(result => this._broadcastResult(result)),
    )
  }

  /**
   * Builds the forward ExchangeIO passed to the wrapped exchange.
   *
   * When the wrapped exchange (e.g. cacheExchange) has a cache miss, it calls forward
   * with the missed operations. This implementation routes each operation to the
   * "owner" spoke (rule #3: origin spoke in priority) via onForward. When the spoke's
   * downstream resolves the operation, it calls resolveForwarded which pushes the result
   * back into the shared result Subject, completing the forward loop.
   */
  private _createForward(): ExchangeIO {
    const { source: resultSrc, next: pushResult } = makeSubject<OperationResult>()

    return ops$ => {
      pipe(
        ops$,
        tap(op => {
          const handle = getOperationHandle(op)

          if (op.kind === 'teardown') {
            // Forward to the spoke that triggered the full teardown (still alive since it just called teardownOperation)
            const triggeringSpoke = this.teardownTriggeredBy.get(handle)
            const spoke = this.spokes.get(triggeringSpoke ?? '')
            if (spoke) void spoke.callbacks.onForward(serializeOp(op))
            this.forwardingSpokes.delete(handle)
            this.teardownTriggeredBy.delete(handle)
            this.pendingForwards.delete(handle)
            return
          }

          const ownerId = this._getOwnerSpoke(handle)
          const spoke = (ownerId && this.spokes.get(ownerId)) || this.getFallbackSpoke()

          if (!spoke) return

          // Track who is handling this forward (for subscription handoff)
          this.forwardingSpokes.set(handle, spoke.id)
          this.pendingForwards.set(handle, serialized => {
            pushResult(deserializeResult(serialized, op))
          })
          void spoke.callbacks.onForward(serializeOp(op))
        }),
        publish,
      )

      return resultSrc
    }
  }

  /** Returns the ID of the first spoke subscribed to the given key (rule #3: origin priority). */
  private _getOwnerSpoke(handle: OperationHandle): string | undefined {
    for (const id of this.operationSubscribers.get(handle) ?? []) {
      return id
    }
    return undefined
  }

  private _broadcastResult(result: OperationResult): void {
    const serialized = serializeResult(result)
    const subscribers = this.operationSubscribers.get(getOperationHandle(result.operation))
    if (!subscribers) return

    // Subscriptions and queries/mutations are broadcast to all current subscribers.
    // The distinction is important: all subscribers should receive results, not just originators.
    for (const spokeId of subscribers) {
      const spoke = this.spokes.get(spokeId)
      if (spoke) void spoke.callbacks.onResult(serialized)
    }
  }
}
