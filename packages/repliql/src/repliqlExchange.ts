import type { ReactiveKysely } from '@repliql/reactive-kysely'
import {
  getEntityTypename,
  randomId,
  getFullFieldName,
  type Entity,
  isEntityHandle,
  getEntityRef,
} from '@repliql/utils'
import type { Operation, OperationResult, Exchange } from '@urql/core'
import { executeExchange } from '@urql/exchange-execute'
import DataLoader from 'dataloader'
import type { GraphQLFieldResolver, GraphQLSchema } from 'graphql'
import { filter, make, map, merge, pipe, tap } from 'wonka'

import { Database } from './database'
import type { DatabaseSchema } from './database/schema'
import { persistOperationResult } from './persistOperationResult'

type ResolverContext = {
  operation: Operation
  db: Database
  queryById: DataLoader<string, { id: string; data: unknown } | undefined>
  entityByRef: DataLoader<string, Entity | undefined>
}

type Resolvers = Record<
  'Query' | 'Mutation' | (string & {}),
  Record<string, GraphQLFieldResolver<any, ResolverContext, any, any>>
>

type RepliqlExchangeConfig = {
  kysely: ReactiveKysely<DatabaseSchema>
  schema: GraphQLSchema
  resolvers: Resolvers
}

export function repliqlExchange({ kysely, schema, resolvers }: RepliqlExchangeConfig): Exchange {
  return ({ forward, ...input }) => {
    return operations$ => {
      const db = new Database({ kysely })

      void db.migrate()

      /**
       * Will execute queries and mutations
       */
      const execute = executeExchange({
        schema,
        context: (operation: Operation): ResolverContext => {
          const queryById = new DataLoader<string, { id: string; data: unknown } | undefined>(
            async queryIds => {
              console.time('=== LOAD QUERY ' + queryIds.join(', '))
              const queries = await db.getQueriesById({ queryIds })
              console.timeEnd('=== LOAD QUERY ' + queryIds.join(', '))
              return queryIds.map(queryId => queries.find(q => q.id === queryId) || undefined)
            },
          )

          const entityByRef = new DataLoader<string, Entity | undefined>(async entityRefs => {
            console.time('=== LOAD ENTITY ' + entityRefs.join(', '))
            const entities = await db.getEntitiesByRef({ entityRefs })
            console.timeEnd('=== LOAD ENTITY ' + entityRefs.join(', '))
            return entityRefs.map(
              entityRef => entities.find(e => e.__ref === entityRef) || undefined,
            )
          })

          return { operation, db, queryById, entityByRef }
        },
        typeResolver: parent => {
          return parent ? getEntityTypename(parent) : undefined
        },
        fieldResolver: async (parent, args, ctx: ResolverContext, info) => {
          if (isEntityHandle(parent)) {
            const parentEntity = await ctx.entityByRef.load(getEntityRef(parent))
            parent = parentEntity?.data
          }

          const resolver = resolvers[info.parentType.name]?.[info.fieldName]
          if (resolver) {
            return resolver(parent, args, ctx, info)
          }

          const fieldName = getFullFieldName({ name: info.fieldName, args })

          if (!parent) {
            if (info.path.typename === 'Query') {
              const query = await ctx.queryById.load(fieldName)
              if (query) {
                return query.data
              }
            }

            throw new Error('no resolver or parent ' + fieldName)
          }

          let value = parent[fieldName]
          if (typeof value === 'function') {
            value = await value()
          }

          return value
        },
      })

      const noopForward: typeof forward = () => make<OperationResult>(() => () => undefined)
      const executeIO = execute({ forward: noopForward, ...input })

      // Add an operation id to all operations
      operations$ = pipe(
        operations$,
        map(op => {
          if (!op.context.operationId) {
            op.context.operationId = randomId()
          }
          return op
        }),
      )

      const localResults$ = pipe(
        operations$,
        tap(op => console.time(`===== LOCAL RESOLUTION ${op.kind} ${op.key}`)),
        executeIO,
        tap(op =>
          console.timeEnd(`===== LOCAL RESOLUTION ${op.operation.kind} ${op.operation.key}`),
        ),
        tap(r => console.log('================== local hit', r.error, r.data)),
      )

      const localHits$ = pipe(
        localResults$,
        filter(r => !r.error),
      )

      const fetchResults$ = pipe(
        operations$,
        forward,
        // tap(opResult => {
        //   // const { operation } = opResult
        //   // const opId = operation.context.operationId
        //   // const hasError = !!opResult.error

        //   // if (operation.kind === 'mutation') {
        //   //   const isOffline = operation.context.isOffline

        //   //   if (hasError && !isOffline) {
        //   //     // Add operation to offline queue
        //   //     offlineMutations.push(
        //   //       makeOperation(operation.kind, operation, {
        //   //         ...operation.context,
        //   //         isOffline: true,
        //   //       }),
        //   //     )
        //   //   } else if (!hasError && isOffline) {
        //   //     // Remove operation from queue
        //   //     offlineMutations = offlineMutations.filter(o => o.context.operationId !== opId)
        //   //   }

        //   //   if (!hasError) {
        //   //     delete optimisticUpdates[opId]
        //   //   }
        //   // }
        // }),
        tap(persistOperationResult({ db })),
        filter(r => !r.error),
      )

      return merge([fetchResults$, localHits$])
    }
  }
}
