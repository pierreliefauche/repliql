/**
 * Message envelopes exchanged between tab, shared worker, and dedicated worker.
 * Every envelope carries a `__conduit` discriminator so unrelated `postMessage`
 * traffic on the same port can be safely ignored.
 */

/** Tab → dedicated worker: hands over a MessageChannel port to expose its API on. */
export const CONDUIT_DEDICATED_PORT = 'dedicated-port' as const
/** Tab → shared worker: registers this tab and the port pointing at its dedicated worker. */
export const CONDUIT_REGISTER_TAB = 'register-tab' as const
/** Tab → shared worker: explicit teardown signal (sent on `pagehide` / `dispose`). */
export const CONDUIT_UNREGISTER_TAB = 'unregister-tab' as const
/** Shared worker → dedicated worker: the dedicated worker is becoming leader */
export const CONDUIT_ELECTED_LEADER = 'elected-leader' as const

export interface DedicatedPortMessage {
  __conduit: typeof CONDUIT_DEDICATED_PORT
  port: MessagePort
}

export interface RegisterTabMessage {
  __conduit: typeof CONDUIT_REGISTER_TAB
  tabId: string
  port: MessagePort
}

export interface UnregisterTabMessage {
  __conduit: typeof CONDUIT_UNREGISTER_TAB
  tabId: string
}

export interface ElectedLeaderMessage {
  __conduit: typeof CONDUIT_ELECTED_LEADER
}

export function isDedicatedPortMessage(data: unknown): data is DedicatedPortMessage {
  if (typeof data !== 'object' || data === null) {
    return false
  }
  const msg = data as Partial<DedicatedPortMessage>
  return msg.__conduit === CONDUIT_DEDICATED_PORT && msg.port instanceof MessagePort
}

export function isRegisterTabMessage(data: unknown): data is RegisterTabMessage {
  if (typeof data !== 'object' || data === null) {
    return false
  }
  const msg = data as Partial<RegisterTabMessage>
  return (
    msg.__conduit === CONDUIT_REGISTER_TAB &&
    msg.port instanceof MessagePort &&
    typeof msg.tabId === 'string'
  )
}

export function isUnregisterTabMessage(data: unknown): data is UnregisterTabMessage {
  if (typeof data !== 'object' || data === null) {
    return false
  }
  const msg = data as Partial<UnregisterTabMessage>
  return msg.__conduit === CONDUIT_UNREGISTER_TAB && typeof msg.tabId === 'string'
}

export function isElectedLeaderMessage(data: unknown): data is ElectedLeaderMessage {
  if (typeof data !== 'object' || data === null) {
    return false
  }
  const msg = data as Partial<ElectedLeaderMessage>
  return msg.__conduit === CONDUIT_ELECTED_LEADER
}

/**
 * Thrown by `wrapDedicatedWorker`-routed calls (and `Broker.callOnLeader`)
 * when the leader tab dies or unregisters while the call is in flight.
 * Catch this to retry against the next-elected leader.
 */
export class LeaderResignedError extends Error {
  constructor(message: string = 'Leader resigned during call') {
    super(message)
    this.name = 'LeaderResignedError'
  }
}
