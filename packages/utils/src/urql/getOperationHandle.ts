import type { Operation } from '@urql/core'

export type OperationHandle = number | string

type OperationLike = Pick<Operation, 'kind' | 'key'> & {
  context: Partial<Pick<Operation['context'], 'operationId' | '_instance'>>
}

export function getOperationHandle(operation: OperationLike): OperationHandle {
  // Mutations should be identified uniquely, even for same query+variables
  if (operation.kind === 'mutation') {
    if (operation.context?.operationId) {
      return operation.context.operationId
    }

    if (operation.context?._instance) {
      return `${operation.key}.${operation.context._instance}`
    }
  }

  // Other operations are idempotent
  return operation.key
}
