import { type HashValue, phash, stableStringify, SourceMap, areEqual } from '@repliql/utils'
import { CompiledQuery, Kysely, KyselyConfig, ParseJSONResultsPlugin, sql } from 'kysely'
import {
  concat,
  filter,
  fromPromise,
  lazy,
  makeSubject,
  merge,
  mergeMap,
  onEnd,
  onStart,
  pipe,
  share,
  debounce,
  Source,
  tap,
} from 'wonka'

import { type ChangeSubscription, changeSubscriptionTables } from './ChangeSubscription'
import { DEFAULT_QUERY_UPDATE_DEBOUNCE_MS } from './constants'
import { compileChangeSubscription, isChangeSubscriptionUpdate } from './isChangeSubscriptionUpdate'
import { queryToChangeSubscription } from './queryToChangeSubscription'
import { AnyTable, Row, RowUpdate } from './types'

type CreateCallbackFunction = (
  callbackName: string,
  callback: (oldJson: string | null, newJson: string | null) => void,
) => void | Promise<void>

export type ReactiveKyselyConfig = KyselyConfig & {
  createCallbackFunction: CreateCallbackFunction
  queryUpdateDebounceMs?: number
  ignoreColumnUpdate?: (table: string, column: string) => boolean
}

export class ReactiveKysely<DB = any> extends Kysely<DB> {
  protected createCallbackFunction: CreateCallbackFunction
  private ignoreColumnUpdate: (table: string, column: string) => boolean

  private defaultQueryUpdateDebounceMs: number
  private queryUpdateDebounceMs = new Map<HashValue, number>()

  private rowUpdatesSubject = makeSubject<RowUpdate<DB>>()
  private tableRowUpdatesSources = new SourceMap<RowUpdate<DB>, string>()
  private changeSubscriptionSources = new SourceMap<RowUpdate<DB>>()
  private queryUpdateSources = new SourceMap<unknown>()

  private watchedTables = new Set<AnyTable<DB>>()

  private dbSchemaPromise:
    | undefined
    | Promise<{
        [Table in AnyTable<DB>]: { name: string; isJson: boolean }[]
      }>

  constructor({
    createCallbackFunction,
    queryUpdateDebounceMs,
    ignoreColumnUpdate,
    ...config
  }: ReactiveKyselyConfig) {
    // Ensure the plugin to parse JSON is present
    const plugins = config.plugins || []

    if (!plugins.some(plugin => plugin instanceof ParseJSONResultsPlugin)) {
      plugins.push(new ParseJSONResultsPlugin())
    }

    super({
      ...config,
      plugins,
    })

    this.createCallbackFunction = createCallbackFunction
    this.defaultQueryUpdateDebounceMs = queryUpdateDebounceMs ?? DEFAULT_QUERY_UPDATE_DEBOUNCE_MS
    this.ignoreColumnUpdate =
      ignoreColumnUpdate || ((_table: string, column: string) => column.startsWith('$'))
  }

  private get logger() {
    return {
      error(...args: unknown[]) {
        console.error('[ReactiveKysely]', ...args)
      },
      warn(...args: unknown[]) {
        console.warn('[ReactiveKysely]', ...args)
      },
      debug(...args: unknown[]) {
        console.debug('[ReactiveKysely]', ...args)
      },
    }
  }

  private async getDbSchema(): NonNullable<ReactiveKysely<DB>['dbSchemaPromise']> {
    if (this.dbSchemaPromise) {
      return this.dbSchemaPromise
    }

    const promise = this.introspection.getTables().then(tables => {
      const schema = {} as {
        [Table in AnyTable<DB>]: { name: string; isJson: boolean }[]
      }

      for (const { name, columns, isView } of tables) {
        if (!isView) {
          schema[name as AnyTable<DB>] = columns.map(col => ({
            name: col.name,
            isJson: col.dataType.toLowerCase().startsWith('json'),
          }))
        }
      }

      return schema
    })

    this.dbSchemaPromise = promise

    promise.catch(() => {
      this.dbSchemaPromise = undefined
    })

    return promise
  }

  private async watchTable<Table extends AnyTable<DB>>(table: Table) {
    if (!this.watchedTables.has(table)) {
      this.watchedTables.add(table)

      try {
        // Schema is fetched to validate the table exists and get column info for future use
        const schema = await this.getDbSchema()
        const columns = schema[table]

        if (!columns?.length) {
          throw new Error(`Table "${table}" not found in database schema`)
        }

        // Register a callback function that SQLite triggers will invoke
        const fnName = `repliql_notify_${table}`

        // The callback receives: (oldRowJson, newRowJson)
        // We cast to () => void since the type is simplified, but SQLite passes args
        const callback = (oldJson: string | null, newJson: string | null) => {
          const oldRow = oldJson ? (JSON.parse(oldJson) as Row<DB, Table>) : null
          const newRow = newJson ? (JSON.parse(newJson) as Row<DB, Table>) : null

          this.logger.debug(`Table callback table=${table}`, { oldRow, newRow })

          this.rowUpdatesSubject.next({
            table,
            oldRow,
            newRow,
          })
        }

        // Build JSON object expression for all columns
        function toJson(prefix: 'NEW' | 'OLD') {
          return `json_object(${columns.map(col => `'${col.name}', ${col.isJson ? `json("${prefix}"."${col.name}")` : `"${prefix}"."${col.name}"`}`).join(', ')})`
        }

        await this.createCallbackFunction(fnName, callback)

        // Create INSERT trigger
        await sql
          .raw(
            `CREATE TRIGGER IF NOT EXISTS repliql_insert_${table}
              AFTER INSERT ON "${table}"
              BEGIN
                SELECT ${fnName}(NULL, ${toJson('NEW')});
              END;`,
          )
          .execute(this)

        // Create UPDATE trigger
        await sql
          .raw(
            `CREATE TRIGGER IF NOT EXISTS repliql_update_${table}
              AFTER UPDATE ON "${table}"
              BEGIN
                SELECT ${fnName}(${toJson('OLD')}, ${toJson('NEW')});
              END;`,
          )
          .execute(this)

        // Create DELETE trigger
        await sql
          .raw(
            `CREATE TRIGGER IF NOT EXISTS repliql_delete_${table}
              AFTER DELETE ON "${table}"
              BEGIN
                SELECT ${fnName}(${toJson('OLD')}, NULL);
              END;`,
          )
          .execute(this)
      } catch (error) {
        this.watchedTables.delete(table)
        throw error
      }
    }
  }

  public async getAllTables() {
    const schema = await this.getDbSchema()
    return Object.keys(schema) as AnyTable<DB>[]
  }

  private async watchAllTables() {
    const tables = await this.getAllTables()
    return Promise.all(tables.map(table => this.watchTable(table)))
  }

  private getAllRowUpdateSource(): Source<RowUpdate<DB>> {
    return this.tableRowUpdatesSources.getOrCreate('*', () => {
      return pipe(
        this.rowUpdatesSubject.source,
        onStart(() => void this.watchAllTables()),
        share,
      )
    })
  }

  public getTableRowUpdateSource<T extends AnyTable<DB>>(table: T): Source<RowUpdate<DB, T>> {
    return this.tableRowUpdatesSources.getOrCreate(table, () => {
      return pipe(
        this.rowUpdatesSubject.source,
        filter(rowUpdate => {
          if (rowUpdate.table !== table) {
            return false
          }

          const { newRow, oldRow } = rowUpdate as RowUpdate<DB, T>

          if (!newRow || !oldRow) {
            return true
          }

          const columns = Object.keys(newRow || oldRow) as (keyof Row<DB, T> & string)[]
          for (const column of columns) {
            if (!this.ignoreColumnUpdate(rowUpdate.table, column)) {
              if (!areEqual(oldRow[column], newRow[column])) {
                return true
              }
            }
          }

          return false
        }),
        tap(rowUpdate =>
          this.logger.debug(`Table row update source table=${rowUpdate.table}`, rowUpdate),
        ),
        onStart(() => this.logger.debug(`Start table row update source table=${table}`)),
        onEnd(() => this.logger.warn(`End table row update source table=${table}`)),
        share,
        onStart(() => void this.watchTable(table)),
      )
    }) as Source<RowUpdate<DB, T>>
  }

  public getChangeSubscriptionSource(sub: ChangeSubscription<DB>): Source<RowUpdate<DB>> {
    const sourceKey = phash(stableStringify(sub))

    return this.changeSubscriptionSources.getOrCreate(sourceKey, () => {
      const tables = changeSubscriptionTables(sub)
      const compiledChangeSubscription = compileChangeSubscription(sub)

      const updatesSource = Array.isArray(tables)
        ? merge(tables.map(table => this.getTableRowUpdateSource(table)))
        : this.getAllRowUpdateSource()

      return pipe(
        updatesSource,
        filter(rowUpdate => isChangeSubscriptionUpdate(compiledChangeSubscription, rowUpdate)),
        tap(rowUpdate =>
          this.logger.debug(`Change Subscription source table=${rowUpdate.table}`, rowUpdate, sub),
        ),
        onStart(() => this.logger.debug(`Start Change Subscription source`, sub)),
        onEnd(() => this.logger.warn(`End Change Subscription source`, sub)),
        // share,
      )
    })
  }

  private getQueryUpdateSource<Result>(
    compiledQuery: CompiledQuery<Result>,
    changeSub: ChangeSubscription<DB>,
    options?: { debounceMs?: number },
  ): Source<Result[]> {
    const debounceMs = options?.debounceMs ?? this.defaultQueryUpdateDebounceMs

    const sourceKey = phash(
      stableStringify({
        sql: compiledQuery.sql,
        parameters: compiledQuery.parameters,
        debounceMs,
      }),
    )

    // Update query update debounce to keep lowest debounce
    if (
      !this.queryUpdateDebounceMs.has(sourceKey) ||
      this.queryUpdateDebounceMs.get(sourceKey)! > debounceMs
    ) {
      this.queryUpdateDebounceMs.set(sourceKey, debounceMs)
    }

    const makeQueryUpdateSource = () => {
      let lastSeenDataHash: undefined | HashValue

      const changeSource = this.getChangeSubscriptionSource(changeSub)

      return pipe(
        changeSource,
        debounce(
          () => this.queryUpdateDebounceMs.get(sourceKey) ?? this.defaultQueryUpdateDebounceMs,
        ),
        mergeMap(() => fromPromise(this.executeQuery(compiledQuery).then(({ rows }) => rows))),
        filter(data => {
          const previousDataHash = lastSeenDataHash
          lastSeenDataHash = phash(stableStringify(data))
          return previousDataHash !== lastSeenDataHash
        }),
        onStart(() => {
          lastSeenDataHash = undefined
        }),
        onEnd(() => {
          lastSeenDataHash = undefined
        }),
        tap(results =>
          this.logger.debug(`Query Update source`, {
            sql: compiledQuery.sql,
            parameters: compiledQuery.parameters,
            results,
          }),
        ),
        share,
      )
    }

    return this.queryUpdateSources.getOrCreate(sourceKey, makeQueryUpdateSource) as ReturnType<
      typeof makeQueryUpdateSource
    >
  }

  public liveQuery<
    Q extends ReturnType<this['selectFrom']>,
    Result = Awaited<ReturnType<Q['execute']>>[number],
  >(query: Q | ((queryBuilder: this) => Q), options?: { debounceMs?: number }): Source<Result[]> {
    const selectQuery = typeof query === 'function' ? query(this) : query

    const changeSub = queryToChangeSubscription(selectQuery)
    if (!changeSub) {
      throw new Error('Invalid operation')
    }

    const queryUpdateSource = this.getQueryUpdateSource<Result>(
      selectQuery.compile(),
      changeSub,
      options,
    )

    // Use lazy() so the initial query executes fresh each time a subscriber
    // subscribes, instead of being cached from the first liveQuery() call
    const debounceMs = options?.debounceMs
    return lazy(() =>
      // We use concat to start listening to changes AFTER the initial request completes
      concat([
        // This should fire as soon as the source is being listened to!
        fromPromise(selectQuery.execute() as Promise<Result[]>),
        // The query update source though can be debounced
        debounceMs ? debounce<Result[]>(() => debounceMs)(queryUpdateSource) : queryUpdateSource,
      ]),
    )
  }
}
