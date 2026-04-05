import type { Operation, OperationResult } from '@urql/core'
import { CombinedError } from '@urql/core'

import type { SerializedOperation, SerializedResult } from './types'

export function generateId(): string {
  return crypto.randomUUID()
}

/**
 * Serializes an Operation for transmission over a MessagePort.
 * Preserves all structured-clone-able context fields; drops functions.
 */
export function serializeOp(op: Operation): SerializedOperation {
  return {
    key: op.key,
    kind: op.kind,
    query: op.query,
    variables: op.variables,
    extensions: op.extensions,
    context: JSON.parse(JSON.stringify(op.context)),
  }
}

/**
 * Reconstructs an Operation from its serialized wire form.
 *
 * If an original operation is provided, non-serializable context fields (fetch, fetchOptions, etc.)
 * are re-hydrated from it while preserving any modifications the hub may have made to serializable
 * fields like variables, extensions, or context values.
 */
export function deserializeOp(serialized: SerializedOperation, originalOp?: Operation): Operation {
  return {
    ...serialized,
    context: { ...originalOp?.context, ...serialized.context },
  } as unknown as Operation
}

export function serializeResult(result: OperationResult): SerializedResult {
  return {
    key: result.operation.key,
    data: result.data,
    error: result.error
      ? {
          message: result.error.message,
          graphQLErrors: result.error.graphQLErrors.map(e => ({
            message: e.message,
            extensions: e.extensions as Record<string, unknown> | undefined,
          })),
          networkError: result.error.networkError
            ? { message: result.error.networkError.message }
            : undefined,
        }
      : undefined,
    stale: result.stale,
    hasNext: result.hasNext,
  }
}

export function deserializeResult(serialized: SerializedResult, op: Operation): OperationResult {
  const error = serialized.error
    ? new CombinedError({
        graphQLErrors: serialized.error.graphQLErrors,
        networkError: serialized.error.networkError
          ? new Error(serialized.error.networkError.message)
          : undefined,
      })
    : undefined

  return {
    operation: op,
    data: serialized.data,
    error,
    stale: serialized.stale,
    hasNext: serialized.hasNext,
  }
}
