import { type Operation, makeOperation, formatDocument } from '@urql/core'

/** Adds unique typenames to query (for invalidating cache entries) */
export const mapTypeNames = (operation: Operation): Operation => {
  const query = formatDocument(operation.query)
  if (query !== operation.query) {
    const formattedOperation = makeOperation(operation.kind, operation)
    formattedOperation.query = query
    return formattedOperation
  } else {
    return operation
  }
}
