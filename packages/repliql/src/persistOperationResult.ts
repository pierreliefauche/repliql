import {
  type Entity,
  type EntityPointer,
  type EntityRef,
  getEntityRef,
  transformQueryData,
  getFullFieldName,
} from '@repliql/utils'
import type { OperationResult } from '@urql/core'

import type { Database } from './database'

type PersistOperationResultConfig = {
  db: Database
}

export function persistOperationResult({ db }: PersistOperationResultConfig) {
  return async (operationResult: OperationResult) => {
    if (operationResult.error) {
      return
    }

    // Normalize result into entities
    const entities: Record<EntityRef, Entity> = {}
    const root = transformQueryData<
      EntityPointer,
      Record<string, EntityPointer | EntityPointer[] | null>
    >(
      {
        query: operationResult.operation.query,
        data: operationResult.data,
        variables: operationResult.operation.variables,
        getFieldName: getFullFieldName,
      },
      (obj): EntityPointer => {
        const __ref = getEntityRef(obj)
        entities[__ref] = {
          ...entities[__ref],
          ...obj,
        }
        return { __ref }
      },
    )

    const byOperationKey = operationResult.operation.key

    await db.upsertEntities({
      entities: Object.values(entities),
      byOperationKey,
      isOptimistic: false,
    })

    if (operationResult.operation.kind === 'query') {
      await db.upsertQueries({
        byOperationKey,
        queries: Object.entries(root).map(([id, data]) => ({
          id,
          data,
        })),
      })
    } else if (operationResult.operation.kind === 'mutation') {
      await db.resolveMutation({
        mutationId: operationResult.operation.context.operationId,
        status: 'applied',
      })
    }
  }
}
