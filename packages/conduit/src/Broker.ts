import type { Remote } from 'comlink'
import { wrap } from 'comlink'

import { heartbeat as defaultHeartbeat, type Heartbeat } from './heartbeat'
import { LeaderResignedError } from './protocol'

interface TabEntry<T> {
  remote: Remote<T>
  port: MessagePort | null
  registeredAt: number
}

export interface BrokerListeners {
  /** Fired when `leaderId` is promoted. Also fires immediately on `addListener` if a leader already exists. */
  onLeaderElected?: (leaderId: string) => void
  /** Fired when `leaderId` (the current leader) dies or unregisters. Always followed by an `onLeaderElected` if any tabs remain. */
  onLeaderResigned?: (leaderId: string) => void
}

type Dispatch<T> = (leaderId: string, remote: Remote<T>) => void

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
  private readonly heartbeat: Heartbeat
  private readonly tabs = new Map<string, TabEntry<T>>()
  private currentLeaderId: string | null = null
  private readonly listeners = new Set<BrokerListeners>()
  private readonly pendingDispatches: Dispatch<T>[] = []
  private readonly inflightByLeader = new Map<string, Set<() => void>>()

  constructor(heartbeat: Heartbeat = defaultHeartbeat) {
    this.heartbeat = heartbeat
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
      return
    }

    this.tabs.set(tabId, { remote, port, registeredAt: Date.now() })

    this.heartbeat.onStop(tabId, () => {
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
    this._removeTab(tabId)
  }

  /**
   * Subscribe to leader-election events. Returns an unsubscribe function. If
   * a leader already exists at subscription time, `onLeaderElected` is fired
   * synchronously with the current leader id.
   */
  public addListener(listener: BrokerListeners): () => void {
    this.listeners.add(listener)

    if (this.currentLeaderId) {
      listener.onLeaderElected?.(this.currentLeaderId)
    }

    return () => {
      this.listeners.delete(listener)
    }
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
    const entry = this.tabs.get(tabId)
    const inflight = this.inflightByLeader.get(tabId)

    this.tabs.delete(tabId)
    this.inflightByLeader.delete(tabId)

    if (entry?.port) {
      try {
        entry.port.close()
      } catch {
        // ignore — port may already be closed
      }
    }

    if (inflight) {
      for (const onResign of inflight) {
        onResign()
      }
    }

    if (this.currentLeaderId === tabId) {
      const oldLeaderId = tabId
      this.currentLeaderId = null

      for (const l of this.listeners) {
        l.onLeaderResigned?.(oldLeaderId)
      }

      const nextLeaderId = this._pickNextLeader()
      if (nextLeaderId) {
        this._promote(nextLeaderId)
      }
    }
  }

  private _promote(tabId: string): void {
    const entry = this.tabs.get(tabId)
    if (!entry) {
      return
    }

    this.currentLeaderId = tabId

    for (const l of this.listeners) {
      l.onLeaderElected?.(tabId)
    }

    if (this.pendingDispatches.length > 0) {
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
