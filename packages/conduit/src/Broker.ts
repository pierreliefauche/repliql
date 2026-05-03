import { heartbeat, Logger } from '@repliql/utils'
import { wrap, type Remote } from 'comlink'

import { ConduitEventEmitter } from './events'
import { getHeartbeatId } from './getHeartbeatId'
import { CONDUIT_ELECTED_LEADER, LeaderResignedError } from './protocol'

interface TabEntry<T> {
  remote: Remote<T>
  port: MessagePort | null
  registeredAt: number
}

type Dispatch<T> = (leaderId: string, remote: Remote<T>) => void

type BrokerConfig = {
  events: ConduitEventEmitter
  logger: Logger
}

/**
 * Broker living inside the shared worker. It holds a Comlink remote for every
 * registered tab's dedicated worker, elects one tab as leader, and re-elects
 * on tab death (using a `Heartbeat` to detect the death).
 *
 * Callers route work through `callOnLeader`, which queues until the first
 * leader is elected and rejects in-flight calls with `LeaderResignedError`
 * when the leader dies mid-call. The next leader is the *youngest* tab.
 */
export class Broker<T> {
  protected log: Logger
  private readonly tabs = new Map<string, TabEntry<T>>()
  private currentLeaderId: string | null = null
  private readonly pendingDispatches: Dispatch<T>[] = []
  private readonly inflightByLeader = new Map<string, Set<() => void>>()
  public readonly events: ConduitEventEmitter

  constructor({ events, logger }: BrokerConfig) {
    this.events = events
    this.log = logger
  }

  /**
   * Registers `tabId` with the `MessagePort` reaching its dedicated worker.
   * The port is `Comlink.wrap`ed and stored; if no leader exists, this tab is
   * immediately promoted. The broker takes ownership of the port and closes
   * it on removal.
   */
  public registerTab(tabId: string, port: MessagePort): void {
    this._register(tabId, wrap(port), port)
  }

  /**
   * Lower-level registration that accepts an already-wrapped Comlink remote
   * (or any object behaving like one). Exposed for tests; production code
   * uses `registerTab`.
   */
  public register(tabId: string, remote: Remote<T>): void {
    this._register(tabId, remote, null)
  }

  private _register(tabId: string, remote: Remote<T>, port: MessagePort | null): void {
    if (this.tabs.has(tabId)) {
      this.log.warn('Tab is already registered with broker', { tabId })
      return
    }

    this.log.debug('Registering tab with broker', { tabId })
    this.tabs.set(tabId, { remote, port, registeredAt: Date.now() })

    heartbeat.onStop(getHeartbeatId(tabId), () => {
      this.log.debug('Tab heartbeat stopped', { tabId })
      this._removeTab(tabId)
    })

    if (!this.currentLeaderId) {
      this._promote(tabId)
    }
  }

  /**
   * Explicit teardown for a tab — equivalent to the heartbeat reporting the
   * tab as stopped. Triggers re-election if the unregistered tab was leader.
   */
  public unregisterTab(tabId: string): void {
    this.log.debug('Unregistering tab from broker', { tabId })
    this._removeTab(tabId)
  }

  /**
   * Returns the current leader ID, or `null` if no leader is elected.
   */
  public getLeaderId(): string | null {
    return this.currentLeaderId
  }

  /**
   * Dispatches a call against the current leader's remote. If no leader exists, queues
   * until one is promoted. If the leader is replaced before the underlying call resolves,
   * the returned promise rejects with `LeaderResignedError`.
   */
  public callOnLeader<R>(invoke: (remote: Remote<T>) => Promise<R> | R): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      const dispatch: Dispatch<T> = (leaderId, remote) => {
        let settled = false
        const onResign = () => {
          if (settled) {
            return
          }
          settled = true
          reject(new LeaderResignedError())
        }

        let set = this.inflightByLeader.get(leaderId)
        if (!set) {
          set = new Set()
          this.inflightByLeader.set(leaderId, set)
        }

        set.add(onResign)
        const cleanup = () => {
          this.inflightByLeader.get(leaderId)?.delete(onResign)
        }

        Promise.resolve(invoke(remote)).then(
          value => {
            if (settled) {
              return
            }
            settled = true
            cleanup()
            resolve(value)
          },
          err => {
            if (settled) {
              return
            }
            settled = true
            cleanup()
            reject(err)
          },
        )
      }

      const leaderId = this.currentLeaderId
      const entry = leaderId ? this.tabs.get(leaderId) : undefined
      if (leaderId && entry) {
        dispatch(leaderId, entry.remote)
      } else {
        this.pendingDispatches.push(dispatch)
      }
    })
  }

  private _removeTab(tabId: string): void {
    this.log.debug('Removing tab from broker', { tabId })

    const entry = this.tabs.get(tabId)
    const inflight = this.inflightByLeader.get(tabId)

    this.tabs.delete(tabId)
    this.inflightByLeader.delete(tabId)

    if (entry?.port) {
      this.log.debug('Closing tab port', { tabId })
      try {
        entry.port.close()
      } catch (error) {
        // ignore — port may already be closed
        this.log.warn('Failed to close tab port', { tabId, error })
      }
    }

    if (inflight) {
      for (const onResign of inflight) {
        onResign()
      }
    }

    if (this.currentLeaderId === tabId) {
      this.log.debug('Resigning leader', { tabId })

      const oldLeaderId = tabId
      this.currentLeaderId = null

      this.events.emit('leaderResigned', { leaderId: oldLeaderId })

      const nextLeaderId = this._pickNextLeader()
      if (nextLeaderId) {
        this._promote(nextLeaderId)
      }
    }
  }

  private _promote(tabId: string): void {
    const entry = this.tabs.get(tabId)
    if (!entry) {
      this.log.error('Tab not found to promote to leader', { tabId })
      return
    }

    this.log.debug('Promoting leader', { tabId })

    this.currentLeaderId = tabId

    entry.port?.postMessage({ __conduit: CONDUIT_ELECTED_LEADER })

    this.events.emit('leaderElected', { leaderId: tabId, port: entry.port })

    if (this.pendingDispatches.length > 0) {
      this.log.debug('Dispatching pending calls', { count: this.pendingDispatches.length })
      const pending = this.pendingDispatches.splice(0)
      for (const dispatch of pending) {
        dispatch(tabId, entry.remote)
      }
    }
  }

  private _pickNextLeader(): string | null {
    let nextLeaderId: string | null = null
    let newest = -Infinity
    for (const [id, entry] of this.tabs) {
      if (entry.registeredAt > newest) {
        newest = entry.registeredAt
        nextLeaderId = id
      }
    }
    return nextLeaderId
  }
}
