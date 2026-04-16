import type { Client, Exchange, ExchangeIO, Operation, OperationResult } from '@urql/core'
import { makeSubject, pipe, subscribe } from 'wonka'

import { heartbeat as navigatorHeartbeat } from './heartbeat'
import type { Heartbeat, SerializedOperation, SerializedResult, SpokeCallbacks } from './types'
import { deserializeOp, deserializeResult, serializeOp, serializeResult } from './utils'

export interface SharedServiceConfig {
  exchange: Exchange
  heartbeat?: Heartbeat
}

interface SpokeState {
  callbacks: SpokeCallbacks
  /** Operation keys currently active from this spoke. */
  ops: Set<number>
}

export class SharedService {
  private readonly heartbeat: Heartbeat

  /** The wrapped exchange. Assignable to allow hot-swapping (re-execution semantics: TODO). */
  exchange: Exchange

  private readonly spokes: Map<string, SpokeState>
  /** Maps operation key → set of spoke IDs subscribed to it. */
  private readonly operationSubscribers: Map<number, Set<string>>
  /** Maps operation key → the spoke ID currently handling the forward for it. */
  private readonly forwardingSpokes: Map<number, string>
  /** Maps operation key → the spoke ID that triggered the full teardown (last unsubscriber). */
  private readonly teardownTriggeredBy: Map<number, string>
  /** Operation keys whose ops are currently live in the exchange pipeline. */
  private readonly activeOperationKeys: Set<number>
  /**
   * Maps operation key → push function that injects a spoke's forward response back into
   * the hub's forward result stream. Populated in _createForward when onForward fires;
   * consumed by resolveForwarded.
   */
  private readonly pendingForwards: Map<number, (r: SerializedResult) => void>
  /** Stores the deserialized Operation per key for teardown creation. */
  private readonly operationsByKey: Map<number, Operation>
  private readonly operationSubject: ReturnType<typeof makeSubject<Operation>>
  private readonly fakeClient: Client

  constructor({ exchange, heartbeat: _heartbeat }: SharedServiceConfig) {
    if (_heartbeat) {  
      this.heartbeat = _heartbeat  
    } else if (  
      typeof navigator !== 'undefined' &&  
      typeof navigator.locks !== 'undefined'  
    ) {  
      this.heartbeat = navigatorHeartbeat  
    } else {  
      throw new Error(  
        'SharedService requires a heartbeat in environments without navigator.locks. Pass SharedServiceConfig.heartbeat explicitly.'  
      )  
    }  
    
    this.exchange = exchange
    this.spokes = new Map()
    this.operationSubscribers = new Map()
    this.forwardingSpokes = new Map()
    this.teardownTriggeredBy = new Map()
    this.activeOperationKeys = new Set()
    this.pendingForwards = new Map()
    this.operationsByKey = new Map()
    this.operationSubject = makeSubject<Operation>()
    this.fakeClient = this._makeFakeClient()
    this._initExchange()
  }

  /** Register a new spoke connection. Called by the spoke via Comlink. */
  connect(spokeId: string, callbacks: SpokeCallbacks): void {
    this.spokes.set(spokeId, { callbacks, ops: new Set() })

    // Detect disconnection
    this.heartbeat.onStop(spokeId, () => {
      this.disconnect(spokeId)
    })
  }

  /** Unregister a spoke, tearing down all its active operations. */
  disconnect(spokeId: string): void {
    const spoke = this.spokes.get(spokeId)
    if (!spoke) return
    for (const key of [...spoke.ops]) {
      this.teardownOperation(spokeId, key)
    }
    this.spokes.delete(spokeId)
  }

  /**
   * Called by a spoke to push an operation into the shared exchange pipeline.
   * Subscriptions are deduplicated: if the same key is already active, the spoke
   * is registered as a subscriber and will receive future results via broadcast.
   * Queries and mutations always execute separately (not deduplicated).
   */
  executeOperation(spokeId: string, serialized: SerializedOperation): void {
    const op = deserializeOp(serialized)

    if (!this.operationsByKey.has(op.key)) {
      this.operationsByKey.set(op.key, op)
    }

    let subscribers = this.operationSubscribers.get(op.key)
    if (!subscribers) {
      subscribers = new Set()
      this.operationSubscribers.set(op.key, subscribers)
    }
    subscribers.add(spokeId)
    this.spokes.get(spokeId)?.ops.add(op.key)

    // Rule #4: only deduplicate subscriptions. Queries and mutations always execute.
    // A new spoke joining an active subscription receives future results via _broadcastResult.
    if (op.kind !== 'subscription' || !this.activeOperationKeys.has(op.key)) {
      this.activeOperationKeys.add(op.key)
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
  teardownOperation(spokeId: string, key: number): void {
    const subscribers = this.operationSubscribers.get(key)
    subscribers?.delete(spokeId)
    this.spokes.get(spokeId)?.ops.delete(key)

    const op = this.operationsByKey.get(key)
    const forwardingSpokeId = this.forwardingSpokes.get(key)

    // If the forwarding spoke is leaving but others remain, hand off the subscription
    if (
      spokeId === forwardingSpokeId &&
      subscribers &&
      subscribers.size > 0 &&
      op?.kind === 'subscription'
    ) {
      // Tell the old spoke to teardown its forward subscription
      const oldSpoke = this.spokes.get(spokeId)
      if (oldSpoke) {
        void oldSpoke.callbacks.onForward(serializeOp({ ...op, kind: 'teardown' }))
      }

      // Hand off to a new spoke
      const newSpokeId = this._getOwnerSpoke(key)
      const newSpoke = newSpokeId && this.spokes.get(newSpokeId)
      if (newSpoke && newSpokeId) {
        this.forwardingSpokes.set(key, newSpokeId)
        void newSpoke.callbacks.onForward(serializeOp(op))
      }
      return
    }

    if (!subscribers || subscribers.size === 0) {
      this.operationsByKey.delete(key)
      this.operationSubscribers.delete(key)
      this.activeOperationKeys.delete(key)
      this.pendingForwards.delete(key)
      this.forwardingSpokes.delete(key)
      // Track that this spoke triggered the full teardown
      this.teardownTriggeredBy.set(key, spokeId)

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
  resolveForwarded(_spokeId: string, key: number, result: SerializedResult): void {
    this.pendingForwards.get(key)?.(result)
  }

  private _makeFakeClient(): Client {
    const service = this
    return {
      // When the wrapped exchange calls reexecuteOperation (e.g. cacheExchange invalidating
      // a cached key), delegate back to the origin spoke's URQL client so the spoke's full
      // exchange chain handles the re-fetch — not the hub in isolation.
      reexecuteOperation(op: Operation): void {
        const ownerId = service._getOwnerSpoke(op.key)
        const spoke = service.spokes.get(ownerId ?? '')
        if (spoke) {
          void spoke.callbacks.onReexecute(serializeOp(op))
        }
      },
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
        subscribe(op => {
          if (op.kind === 'teardown') {
            // Forward to the spoke that triggered the full teardown (still alive since it just called teardownOperation)
            const triggeringSpoke = this.teardownTriggeredBy.get(op.key)
            const spoke = this.spokes.get(triggeringSpoke ?? '')
            if (spoke) void spoke.callbacks.onForward(serializeOp(op))
            this.forwardingSpokes.delete(op.key)
            this.teardownTriggeredBy.delete(op.key)
            this.pendingForwards.delete(op.key)
            return
          }

          const ownerId = this._getOwnerSpoke(op.key)
          const spoke = ownerId && this.spokes.get(ownerId)

          if (!spoke || !ownerId) return

          // Track who is handling this forward (for subscription handoff)
          this.forwardingSpokes.set(op.key, ownerId)
          this.pendingForwards.set(op.key, serialized => {
            const storedOp = this.operationsByKey.get(op.key) ?? op
            pushResult(deserializeResult(serialized, storedOp))
          })
          void spoke.callbacks.onForward(serializeOp(op))
        }),
      )
      return resultSrc
    }
  }

  /** Returns the ID of the first spoke subscribed to the given key (rule #3: origin priority). */
  private _getOwnerSpoke(key: number): string | undefined {
    for (const id of this.operationSubscribers.get(key) ?? []) {
      return id
    }
    return undefined
  }

  private _broadcastResult(result: OperationResult): void {
    const serialized = serializeResult(result)
    const subscribers = this.operationSubscribers.get(result.operation.key)
    if (!subscribers) return

    // Subscriptions and queries/mutations are broadcast to all current subscribers.
    // The distinction is important: all subscribers should receive results, not just originators.
    for (const spokeId of subscribers) {
      const spoke = this.spokes.get(spokeId)
      if (spoke) void spoke.callbacks.onResult(serialized)
    }
  }
}
