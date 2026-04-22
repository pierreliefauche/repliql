import {
  queryToChangeSubscription,
  type ChangeSubscription,
  type ReactiveKysely,
  type RowUpdate,
  type AnyTable,
  changeSubscriptionTables,
  MATCH_ALL,
  compileChangeSubscription,
  type CompiledChangeSubscription,
  isChangeSubscriptionUpdate,
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
  mapTypeNames,
} from '@repliql/utils'
import {
  type Operation,
  type Exchange,
  makeOperation,
  ExchangeIO,
  OperationResult,
  makeResult,
  makeErrorResult,
} from '@urql/core'
import DataLoader from 'dataloader'
import {
  filter,
  make,
  map,
  merge,
  mergeMap,
  pipe,
  share,
  subscribe,
  Subscription,
  takeUntil,
  tap,
} from 'wonka'

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
  markAsStale: () => void
}

export type Resolvers = Record<
  'Query' | 'Mutation' | (string & {}),
  Record<string, FieldResolver<ResolverContext>>
>

type RepliqlExchangeConfig = {
  kysely: ReactiveKysely<DatabaseSchema>
  resolvers: Resolvers
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
          changeSubs: CompiledChangeSubscription[]
        }
      >()

      const rowUpdateSubscriptionByTable = new Map<AnyTable<DatabaseSchema>, Subscription>()

      function watchTableRowUpdates(table: AnyTable<DatabaseSchema>) {
        if (rowUpdateSubscriptionByTable.has(table)) {
          return
        }

        const sub = pipe(kysely.getTableRowUpdateSource(table), subscribe(onTableRowUpdate))
        rowUpdateSubscriptionByTable.set(table, sub)
      }

      function onTableRowUpdate(rowUpdate: RowUpdate<DatabaseSchema, AnyTable<DatabaseSchema>>) {
        lockAndFlushStaleOperations(() => {
          // Match any operation that depends on that row update
          for (const [opKey, { changeSubs }] of liveQueryOperations.entries()) {
            if (staleOpKeys.has(opKey)) {
              // Already stale, no need to double check
              continue
            }

            const isStale =
              rowUpdate.newRow?.updatedByOperationKey !== opKey &&
              changeSubs.some(changeSub => isChangeSubscriptionUpdate(changeSub, rowUpdate))

            if (isStale) {
              staleOpKeys.add(opKey)
            }
          }
        })
      }

      const staleOpKeys = new Set<number>()
      const locks = new Set<string>()

      async function lockAndFlushStaleOperations<R>(
        callback: () => R | Promise<R>,
      ): Promise<void | R> {
        const lock = randomId()
        locks.add(lock)

        return Promise.resolve()
          .then(() => callback())
          .catch(error => console.error('Error in lock and flush callback', error))
          .finally(() => {
            locks.delete(lock)
            reexecuteStaleOperations()
          })
      }

      function reexecuteStaleOperations() {
        if (locks.size !== 0) {
          return
        }

        const opKeys = [...staleOpKeys]
        staleOpKeys.clear()

        for (const opKey of opKeys) {
          const operation = liveQueryOperations.get(opKey)?.operation
          if (operation) {
            input.client.reexecuteOperation(
              makeOperation(operation.kind, operation, {
                ...operation.context,
                requestPolicy: 'cache-only',
              }),
            )
          }
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
            liveQueryOperations.delete(key)
          } else if (kind === 'query') {
            // console.log('ADD QUERY', key)
            if (!liveQueryOperations.has(key)) {
              liveQueryOperations.set(key, { operation, changeSubs: [] })
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

        const compiledChangeSubs: CompiledChangeSubscription[] = []

        for (const changeSub of changeSubscriptions) {
          // Compile sub and record for later match
          compiledChangeSubs.push(compileChangeSubscription(changeSub))
          // Ensure we watch each table from sub
          const tables = changeSubscriptionTables(changeSub)
          if (tables === MATCH_ALL) {
            kysely.getAllTables().then(tables => tables.map(table => watchTableRowUpdates(table)))
          } else {
            for (const table of tables) {
              watchTableRowUpdates(table)
            }
          }
        }

        // Set compiled subs on liveOp
        liveOp.changeSubs = compiledChangeSubs
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

        let isStale = false
        const markAsStale = () => {
          isStale = true
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
            markAsStale,
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
            if (typeof value === 'undefined') {
              console.error(`Incomplete data fieldName=${fieldName}`)
              throw new Error(`Incomplete data fieldName=${fieldName}`)
            }

            if (typeof value === 'function') {
              value = await value()
            }

            return value
          },
        })

        if (!errors?.length) {
          watchOperation(operation, visits)
        }

        return { data, errors, isStale }
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
                return lockAndFlushStaleOperations(() => executeOperation(operation))
              })
              .then(result => {
                if (ended || !result) {
                  return
                }

                const opResult = makeResult(operation, result)
                if (result.isStale) {
                  opResult.stale = true
                }

                observer.next(opResult)
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
                Boolean(r.error || r.stale) &&
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
            await lockAndFlushStaleOperations(async () => {
              persistOperationResult({ db })(result)

              if (
                result.operation.kind === 'query' &&
                !liveQueryOperations.get(result.operation.key)?.changeSubs.length
              ) {
                console.log('==== EXECUTE AFTER FETCH')
                // This operation has no live change listener,
                // so execute it against cache to trigger a DB watch.
                // This can happen if the cache missed (no cache = no resolution = we don't know what to watch)
                await executeOperation(result.operation).catch(error =>
                  console.error('Failed to re-execute operation after fetch', error),
                )
              }
            })
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
