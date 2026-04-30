import { EventEmitter } from '@repliql/utils'

/**
 * Typed event emitter for conduit leader-election events.
 */

type ConduitEventMap = {
  leaderElected: [{ leaderId: string }]
  leaderResigned: [{ leaderId: string }]
}

export type ConduitEventName = keyof ConduitEventMap

/**
 * Minimal typed event emitter for conduit events.
 *
 * @example
 * ```ts
 * const { events } = conduit()
 * events.on('leaderElected', ({ leaderId }) => console.log('New leader:', leaderId))
 * ```
 */
export class ConduitEventEmitter extends EventEmitter<ConduitEventMap> {}
