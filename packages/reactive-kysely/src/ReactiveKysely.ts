import { type HashValue, phash, stableStringify, SourceMap } from '@repliql/utils'
import { CompiledQuery, Kysely, KyselyConfig, KyselyProps, sql } from 'kysely'
import {
  concat,
  filter,
  fromPromise,
  makeSubject,
  merge,
  mergeMap,
  onStart,
  pipe,
  share,
  Source,
} from 'wonka'

import { type ChangeSubscription, changeSubscriptionTables } from './ChangeSubscription'
import { compileChangeSubscription, isChangeSubscriptionUpdate } from './isChangeSubscriptionUpdate'
import { queryToChangeSubscription } from './queryToChangeSubscription'
import { AnyTable, Row, RowUpdate } from './types'

type CreateCallbackFunction = (
  callbackName: string,
  callback: (oldJson: string | null, newJson: string | null) => void,
) => void | Promise<void>

export type ReactiveKyselyConfig = (KyselyConfig | KyselyProps) & {
  createCallbackFunction: CreateCallbackFunction
}

export class ReactiveKysely<DB = any> extends Kysely<DB> {
  protected createCallbackFunction: CreateCallbackFunction

  private rowUpdatesSubject = makeSubject<RowUpdate<DB>>()
  private tableRowUpdatesSources = new SourceMap<RowUpdate<DB>, string>()
  private changeSubscriptionSources = new SourceMap<RowUpdate<DB>>()
  private queryUpdateSources = new SourceMap<unknown>()

  private watchedTables = new Set<AnyTable<DB>>()

  private dbSchemaPromise:
    | undefined
    | Promise<{
        [Table in AnyTable<DB>]: (keyof DB[Table])[]
      }>

  constructor({ createCallbackFunction, ...config }: ReactiveKyselyConfig) {
    super(config)
    this.createCallbackFunction = createCallbackFunction
  }

  private async getDbSchema(): NonNullable<ReactiveKysely<DB>['dbSchemaPromise']> {
    if (this.dbSchemaPromise) {
      return this.dbSchemaPromise
    }

    const promise = this.introspection.getTables().then(tables => {
      const schema = {} as { [Table in AnyTable<DB>]: (keyof DB[Table])[] }

      for (const table of tables) {
        if (!table.isView) {
          schema[table.name as AnyTable<DB>] = table.columns.map(
            col => col.name,
          ) as (keyof DB[AnyTable<DB>])[]
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

        if (!columns) {
          throw new Error(`Table "${table}" not found in database schema`)
        }

        // Register a callback function that SQLite triggers will invoke
        const fnName = `repliql_notify_${table}`

        // The callback receives: (oldRowJson, newRowJson)
        // We cast to () => void since the type is simplified, but SQLite passes args
        const callback = (oldJson: string | null, newJson: string | null) => {
          const oldRow = oldJson ? (JSON.parse(oldJson) as Row<DB, Table>) : null
          const newRow = newJson ? (JSON.parse(newJson) as Row<DB, Table>) : null

          this.rowUpdatesSubject.next({
            table,
            oldRow,
            newRow,
          })
        }

        // Build JSON object expression for all columns
        function toJson(prefix: 'NEW' | 'OLD') {
          return `json_object(${(columns as string[]).map(col => `'${col}', "${prefix}"."${col}"`).join(', ')}`
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

  private async watchAllTables() {
    const schema = await this.getDbSchema()
    return Promise.all((Object.keys(schema) as AnyTable<DB>[]).map(table => this.watchTable(table)))
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

  private getTableRowUpdateSource<T extends AnyTable<DB>>(table: T): Source<RowUpdate<DB, T>> {
    return this.tableRowUpdatesSources.getOrCreate(table, () => {
      return pipe(
        this.rowUpdatesSubject.source,
        onStart(() => void this.watchTable(table)),
        filter(rowUpdate => rowUpdate.table === table),
        share,
      )
    }) as Source<RowUpdate<DB, T>>
  }

  private getChangeSubscriptionSource(sub: ChangeSubscription<DB>): Source<RowUpdate<DB>> {
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
      )
    })
  }

  private getQueryUpdateSource<Result>(
    compiledQuery: CompiledQuery<Result>,
    changeSub: ChangeSubscription<DB>,
  ): Source<Result[]> {
    const sourceKey = phash(
      stableStringify({ sql: compiledQuery.sql, parameters: compiledQuery.parameters }),
    )

    return this.queryUpdateSources.getOrCreate(sourceKey, () => {
      let lastSeenDataHash: undefined | HashValue

      const changeSource = this.getChangeSubscriptionSource(changeSub)

      return pipe(
        changeSource,
        mergeMap(() => fromPromise(this.executeQuery(compiledQuery).then(({ rows }) => rows))),
        filter(data => {
          const previousDataHash = lastSeenDataHash
          lastSeenDataHash = phash(stableStringify(data))
          return previousDataHash !== lastSeenDataHash
        }),
      )
    }) as Source<Result[]>
  }

  public liveQuery<
    Q extends ReturnType<this['selectFrom']>,
    Result = Awaited<ReturnType<Q['execute']>>[number],
  >(query: Q | ((queryBuilder: this) => Q)): Source<Result[]> {
    const selectQuery = typeof query === 'function' ? query(this) : query

    const changeSub = queryToChangeSubscription(selectQuery)
    if (!changeSub) {
      throw new Error('Invalid operation')
    }

    const queryUpdateSource = this.getQueryUpdateSource<Result>(selectQuery.compile(), changeSub)

    return concat([fromPromise(selectQuery.execute() as Promise<Result[]>), queryUpdateSource])
  }
}
