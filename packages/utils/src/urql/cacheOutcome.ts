import { makeOperation, Operation, CacheOutcome, OperationResult } from '@urql/core'

export function setCacheOutcome(
  result: OperationResult,
  cacheOutcome: CacheOutcome,
): OperationResult {
  result.operation = makeOperation(result.operation.kind, result.operation, {
    meta: {
      ...result.operation.context.meta,
      cacheOutcome,
    },
  })

  return result
}

export function getCacheOutcome(operation: Operation | OperationResult): CacheOutcome | undefined {
  if ('operation' in operation) {
    return getCacheOutcome(operation.operation)
  }

  return operation.context.meta?.cacheOutcome
}
