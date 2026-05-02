import type { Operation } from '@urql/core'
import { map, pipe, share, Source } from 'wonka'

import { randomId } from '../randomId'

declare module '@urql/core' {
  export interface OperationContext {
    operationId: string
  }
}

export function ensureOperationId(operations$: Source<Operation>): Source<Operation> {
  return pipe(
    operations$,
    map(op => {
      if (!op.context.operationId) {
        op.context.operationId = randomId()
      }
      return op
    }),
    share,
  )
}
