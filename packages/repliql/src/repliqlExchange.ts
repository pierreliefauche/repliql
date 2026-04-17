import {
  queryToChangeSubscription,
  type ChangeSubscription,
  type ReactiveKysely,
} from '@repliql/reactive-kysely'
import {
  getEntityTypename,
  randomId,
  getFullFieldName,
  type Entity,
  isEntityHandle,
  getEntityRef,
  EntityPointer,
  EntityRef,
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
  filterEntityPointers: (
    args: Parameters<Database['selectEntityPointersQuery']>[0],
  ) => Promise<EntityPointer[]>
  trackEntityVisit: (ref: string, fieldName: string) => void
}

export type Resolvers = Record<
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

      function watchOperation(operation: Operation) {
        // Watch changes
        const changeSubscriptions: ChangeSubscription<DatabaseSchema>[] =
          operation.context.visits.changeSubscriptions

        const watchedQueryIds = operation.context.visits.queries as string[]
        if (watchedQueryIds.length) {
          changeSubscriptions.push({
            filter: {
              queries: [
                {
                  id: { $in: watchedQueryIds },
                },
              ],
            },
            selection: {
              queries: {
                data: true,
              },
            },
          })
        }

        const watchedEntities = operation.context.visits.entities as {
          [key: string]: Set<string>
        }
        const refsByWatchedFields: Record<string, { refs: EntityRef[]; fields: string[] }> = {}

        for (const [ref, fieldsSet] of Object.entries(watchedEntities)) {
          const fields = [...fieldsSet].sort()
          const key = JSON.stringify(fields)

          refsByWatchedFields[key] ||= { refs: [], fields }
          refsByWatchedFields[key].refs.push(ref as EntityRef)
        }

        for (const { refs, fields } of Object.values(refsByWatchedFields)) {
          const data: Record<string, true> = {}

          for (const field of fields) {
            data[field] = true
          }

          changeSubscriptions.push({
            filter: {
              entities: [
                {
                  __ref: { $in: refs },
                },
              ],
            },
            selection: {
              entities: {
                data,
              },
            },
          })
        }

        console.log(
          '=========== watch ope',
          operation.key,
          JSON.stringify(changeSubscriptions, null, 2),
        )
      }

      // function unwatchOperation(operationKey: number) {

      // }

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

          const entityByRef = new DataLoader<EntityRef, Entity | undefined>(async entityRefs => {
            console.time('=== LOAD ENTITY ' + entityRefs.join(', '))
            const entities = await db.getEntitiesByRef({ entityRefs })
            console.timeEnd('=== LOAD ENTITY ' + entityRefs.join(', '))
            return entityRefs.map(
              entityRef => entities.find(e => e.__ref === entityRef) || undefined,
            )
          })

          const visits: {
            changeSubscriptions: ChangeSubscription<DatabaseSchema>[]
            entities: { [key: string]: Set<string> }
            queries: string[]
          } = { entities: {}, queries: [], changeSubscriptions: [] }
          operation.context.visits = visits

          const trackEntityVisit = (ref: string, fieldName: string) => {
            if (['__typename', 'id'].includes(fieldName)) {
              // Typename and ID do not change, we don't need to watch them
              return
            }

            visits.entities[ref] ||= new Set()
            visits.entities[ref].add(fieldName)
          }

          const filterEntityPointers: ResolverContext['filterEntityPointers'] = async args => {
            const query = db.selectEntityPointersQuery(args)

            const changeSub = queryToChangeSubscription(query)
            if (changeSub) {
              visits.changeSubscriptions.push(changeSub)
            }

            return query.execute()
          }

          return { operation, db, queryById, entityByRef, trackEntityVisit, filterEntityPointers }
        },
        typeResolver: parent => {
          return parent ? getEntityTypename(parent) : undefined
        },
        fieldResolver: async (parent, args, ctx: ResolverContext, info) => {
          const fieldName = getFullFieldName({ name: info.fieldName, args })

          if (isEntityHandle(parent)) {
            const ref = getEntityRef(parent)
            ctx.trackEntityVisit(ref, fieldName)
            const parentEntity = await ctx.entityByRef.load(ref)
            parent = parentEntity?.data
          }

          const resolver = resolvers[info.parentType.name]?.[info.fieldName]
          if (resolver) {
            return resolver(parent, args, ctx, info)
          }

          if (!parent) {
            if (info.path.typename === 'Query') {
              ctx.operation.context.visits.queries.push(fieldName)
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
        tap(r => {
          console.timeEnd(`===== LOCAL RESOLUTION ${r.operation.kind} ${r.operation.key}`)
          console.log('===== LOCAL HIT VISITS', r.operation.context.visits, r.error, r.data)
        }),
      )

      const localHits$ = pipe(
        localResults$,
        filter(r => !r.error),
        tap(({ operation }) => watchOperation(operation)),
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
