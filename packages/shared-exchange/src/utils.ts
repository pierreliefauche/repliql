import type { Operation, OperationResult } from '@urql/core'
import { CombinedError } from '@urql/core'

import type { SerializedOperation, SerializedResult } from './types'

export function generateId(): string {
  return crypto.randomUUID()
}

export function serializeOp(op: Operation): SerializedOperation {
  return {
    key: op.key,
    kind: op.kind,
    query: op.query,
    variables: op.variables,
    url: op.context.url,
    requestPolicy: op.context.requestPolicy,
  }
}

/**
 * Reconstructs a minimal Operation from its serialized wire form.
 * The context only contains fields that were sent over the wire; non-serializable
 * fields (fetch, fetchOptions as a function, etc.) are omitted.
 */
export function deserializeOp(serialized: SerializedOperation): Operation {
  return {
    key: serialized.key,
    kind: serialized.kind,
    query: serialized.query,
    variables: serialized.variables,
    context: {
      url: serialized.url,
      requestPolicy: serialized.requestPolicy,
    },
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
