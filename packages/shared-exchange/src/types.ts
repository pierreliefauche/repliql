import { OperationHandle } from '@repliql/utils'
import type { Operation, OperationContext, OperationResult } from '@urql/core'

type NoFunction<T> = T extends Function ? undefined : T

export type SerializedContext = Partial<{
  [K in keyof OperationContext]: NoFunction<OperationContext[K]>
}>

export type SerializedOperation = Omit<Operation, 'context'> & {
  context: SerializedContext
}

export interface SerializedError {
  message: string
  graphQLErrors: Array<{ message: string; extensions?: Record<string, unknown> }>
  networkError?: { message: string }
}

export type SerializedResult = Omit<OperationResult, 'error' | 'operation'> & {
  handle: OperationHandle
  key: Operation['key']
  error?: SerializedError
}

/**
 * Comlink.proxy()-wrapped callbacks registered by each spoke at connect time.
 * The hub calls these to push results and forward requests back to the spoke.
 */
export interface SpokeCallbacks {
  /** Hub pushes an operation result to the spoke. */
  onResult: (result: SerializedResult) => void
  /** Hub asks the spoke's downstream exchanges to execute an operation. */
  onForward: (op: SerializedOperation) => void
  /** Hub asks the spoke's URQL client to reexecute an operation (e.g. cache invalidation). */
  onReexecute: (op: SerializedOperation) => void
}

/** Config type for functions that accept a raw MessagePort endpoint. */
export type EndpointConfig = { endpoint: MessagePort; heartbeat?: Heartbeat }

export type Heartbeat = {
  start: (id: string) => Promise<void>
  onStop: (id: string, callback: () => void) => void
}
