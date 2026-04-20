import {
  queryToChangeSubscription,
  type ChangeSubscription,
  type ReactiveKysely,
} from '@repliql/reactive-kysely'
import {
  randomId,
  getFullFieldName,
  type Entity,
  isEntityHandle,
  getEntityRef,
  EntityPointer,
  EntityRef,
  execute,
  FieldResolver,
  compile,
  CompiledOperation,
} from '@repliql/utils'
import {
  type Operation,
  type Exchange,
  makeOperation,
  ExchangeIO,
  OperationResult,
  makeResult,
  makeErrorResult,
  formatDocument,
} from '@urql/core'
import DataLoader from 'dataloader'
import { filter, make, map, merge, mergeMap, pipe, share, subscribe, takeUntil, tap } from 'wonka'

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
  Record<string, FieldResolver<ResolverContext>>
>

type RepliqlExchangeConfig = {
  kysely: ReactiveKysely<DatabaseSchema>
  resolvers: Resolvers
}

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

export function repliqlExchange({ kysely, resolvers }: RepliqlExchangeConfig): Exchange {
  return ({ forward, ...input }) => {
    return _operations$ => {
      const db = new Database({ kysely })
      void db.migrate()

      const liveQueryOperations = new Map<
        number,
        {
          operation: Operation
          unsubscribeFromChanges?: () => void
          changeSubs?: ChangeSubscription<DatabaseSchema>[]
          visits?: unknown
        }
      >()

      // @ts-ignore
      window.dumpLiveQueries = () => {
        for (const [key, q] of liveQueryOperations.entries()) {
          console.log(key, q)
        }
      }

      const operations$ = pipe(
        _operations$,
        // Add an operation id to all operations
        map(op => {
          mapTypeNames
          if (!op.context.operationId) {
            op.context.operationId = randomId()
          }
          return op
        }),
        // Keep track of live query operations
        tap(operation => {
          const { key, kind } = operation

          if (kind === 'teardown') {
            // console.log('TEARDOWN', key)
            const liveOp = liveQueryOperations.get(key)
            liveOp?.unsubscribeFromChanges?.()
            liveQueryOperations.delete(key)
          } else if (kind === 'query') {
            // console.log('ADD QUERY', key)
            if (!liveQueryOperations.has(key)) {
              liveQueryOperations.set(key, { operation })
            }
          }
        }),
        share,
      )

      function watchOperation(
        operation: Operation,
        visits: {
          changeSubscriptions: ChangeSubscription<DatabaseSchema>[]
          entities: { [key: string]: Set<string> }
          queries: string[]
        },
      ) {
        const liveOp = liveQueryOperations.get(operation.key)
        if (!liveOp) {
          return
        }

        // Watch changes
        const changeSubscriptions: ChangeSubscription<DatabaseSchema>[] = [
          ...visits.changeSubscriptions,
        ]

        const watchedQueryIds = visits.queries as string[]
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

        const watchedEntities = visits.entities as {
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

        // First, unsubscribe from previous watch
        const prevUnsubscribe = liveOp.unsubscribeFromChanges
        liveOp.unsubscribeFromChanges = undefined
        liveOp.changeSubs = undefined
        liveOp.visits = undefined
        console.log('======= watch', changeSubscriptions, liveOp)
        if (changeSubscriptions.length) {
          // The create new sub
          liveOp.changeSubs = changeSubscriptions
          liveOp.visits = visits
          liveOp.unsubscribeFromChanges = pipe(
            merge(changeSubscriptions.map(sub => db.client.getChangeSubscriptionSource(sub))),
            // tap(c =>
            //   console.log(
            //     '====++++++=====+++++++====++++==== CHANGE RECEIVED',
            //     operation.key,
            //     c.newRow?.updatedByOperationKey,
            //     c,
            //   ),
            // ),
            filter(change => {
              return change.newRow?.updatedByOperationKey !== operation.key
            }),
            // onStart(() =>
            //   console.log(
            //     '====++++++=====+++++++====++++==== START LISTENING',
            //     operation.key,
            //     phash(stableStringify(changeSubscriptions)),
            //   ),
            // ),
            // onEnd(() =>
            //   console.log(
            //     '====++++++=====+++++++====++++==== STOPPPPPP LISTENING',
            //     operation.key,
            //     phash(stableStringify(changeSubscriptions)),
            //   ),
            // ),
            subscribe(() =>
              input.client.reexecuteOperation(
                makeOperation(operation.kind, operation, {
                  ...operation.context,
                  requestPolicy: 'cache-only',
                }),
              ),
            ),
          ).unsubscribe
        }

        // Unsubscribe from previous sources
        prevUnsubscribe?.()
      }

      const compiledByOperationKey = new Map<number, CompiledOperation>()

      async function executeOperation(operation: Operation) {
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
            entityRef => entities.find(e => e.__ref === entityRef)?.data || undefined,
          )
        })

        const visits: {
          changeSubscriptions: ChangeSubscription<DatabaseSchema>[]
          entities: { [key: string]: Set<string> }
          queries: string[]
        } = { entities: {}, queries: [], changeSubscriptions: [] }

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

        // Filter undefined values from variables before calling execute()
        // to support default values within directives.
        const variableValues = Object.create(null)
        if (operation.variables) {
          for (const key in operation.variables) {
            if (operation.variables[key] !== undefined) {
              variableValues[key] = operation.variables[key]
            }
          }
        }

        if (!compiledByOperationKey.has(operation.key)) {
          compiledByOperationKey.set(operation.key, compile(operation.query))
        }

        const { data, errors } = await execute<ResolverContext>({
          compiled: compiledByOperationKey.get(operation.key)!,
          variableValues,
          context: {
            operation,
            db,
            queryById,
            entityByRef,
            trackEntityVisit,
            filterEntityPointers,
          },
          fieldResolver: async (parent, args, ctx: ResolverContext, info) => {
            const fieldName = getFullFieldName({ name: info.fieldName, args })

            if (isEntityHandle(parent)) {
              const ref = getEntityRef(parent)
              ctx.trackEntityVisit(ref, fieldName)
              const parentEntity = await ctx.entityByRef.load(ref)
              if (parentEntity) {
                parent = parentEntity
              }
            }

            const parentTypename = parent
              ? parent.__typename
              : info.rootOperation === 'query'
                ? 'Query'
                : 'Mutation'

            const resolver = resolvers[parentTypename]?.[info.fieldName]
            if (resolver) {
              return resolver(parent, args, ctx, info)
            }

            if (!parent) {
              if (parentTypename === 'Query') {
                visits.queries.push(fieldName)
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

        if (!errors?.length) {
          watchOperation(operation, visits)
        }

        return { data, errors }
      }

      const executeExchange: ExchangeIO = mergeMap((operation: Operation) => {
        const { key } = operation
        const teardown$ = pipe(
          operations$,
          filter(op => op.kind === 'teardown' && op.key === key),
        )

        return pipe(
          make<OperationResult>(observer => {
            let ended = false

            Promise.resolve()
              .then(() => {
                if (ended) return
                return executeOperation(operation)
              })
              .then(result => {
                if (ended || !result) {
                  return
                }
                observer.next(makeResult(operation, result))
              })
              .catch(error => {
                observer.next(makeErrorResult(operation, error))
              })
              .finally(() => observer.complete())

            return () => {
              ended = true
            }
          }),
          takeUntil(teardown$),
        )
      })

      const localResults$ = pipe(
        operations$,
        filter(
          op =>
            (op.kind === 'query' || op.kind === 'mutation') &&
            op.context.requestPolicy !== 'network-only',
        ),
        // tap(op => console.time(`===== LOCAL RESOLUTION ${op.kind} ${op.key}`)),
        executeExchange,
        // tap(r => {
        //   console.timeEnd(`===== LOCAL RESOLUTION ${r.operation.kind} ${r.operation.key}`)
        //   console.log('===== LOCAL HIT VISITS', r.error, r.data)
        // }),
        tap(result => {
          if (result.operation.context.requestPolicy === 'cache-and-network') {
            result.stale = true
          }
        }),
        share,
      )

      const fetchResults$ = pipe(
        merge([
          // Forward failed local results, if not cache only or cache-and-network
          pipe(
            localResults$,
            filter(
              r =>
                !!r.error &&
                r.operation.context.requestPolicy !== 'cache-only' &&
                r.operation.context.requestPolicy !== 'cache-and-network',
            ),
            map(result => {
              result.stale = true
              return result.operation
            }),
          ),
          // Forward teardowns and operations that should be fetched whatever the cache result
          pipe(
            operations$,
            filter(
              op =>
                op.kind !== 'query' ||
                op.context.requestPolicy === 'cache-and-network' ||
                op.context.requestPolicy === 'network-only',
            ),
          ),
        ]),
        map(mapTypeNames),
        forward,
        tap(async result => {
          if (!result.error) {
            await persistOperationResult({ db })(result)

            if (
              result.operation.kind === 'query' &&
              !liveQueryOperations.get(result.operation.key)?.unsubscribeFromChanges
            ) {
              console.log('==== EXECUTE AFTER FETCH')
              // This operation has no live change listener,
              // so execute it against cache to trigger a DB watch.
              // This can happen if the cache missed (no cache = no resolution = we don't know what to watch)
              await executeOperation(result.operation).catch(error =>
                console.error('Failed to re-execute operation after fetch', error),
              )
            }
          }
        }),
        filter(r => !r.error),
      )

      return merge([
        fetchResults$,
        // From cache
        pipe(
          localResults$,
          filter(r => !r.error || r.operation.context.requestPolicy === 'cache-only'),
        ),
      ])
    }
  }
}
