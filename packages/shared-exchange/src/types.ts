import type { AnyVariables, Operation, OperationType, RequestPolicy } from '@urql/core'

export interface SerializedOperation {
  key: number
  kind: OperationType
  /** The GraphQL document AST — same type as Operation['query'], structured-clone-able. */
  query: Operation['query']
  variables?: AnyVariables
  url: string
  requestPolicy: RequestPolicy
}

export interface SerializedError {
  message: string
  graphQLErrors: Array<{ message: string; extensions?: Record<string, unknown> }>
  networkError?: { message: string }
}

export interface SerializedResult {
  key: number
  data?: unknown
  error?: SerializedError
  stale: boolean
  hasNext: boolean
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
export type EndpointConfig = { endpoint: MessagePort }
