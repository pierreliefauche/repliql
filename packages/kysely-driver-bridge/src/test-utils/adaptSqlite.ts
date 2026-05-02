import type { Database } from 'node-sqlite3-wasm'

type KyselySqliteStatement = {
  reader: boolean
  all(params: ReadonlyArray<unknown>): unknown[]
  run(params: ReadonlyArray<unknown>): {
    changes: number | bigint
    lastInsertRowid: number | bigint
  }
  iterate(params: ReadonlyArray<unknown>): IterableIterator<unknown>
}

type KyselySqliteDatabase = {
  close(): void
  prepare(sql: string): KyselySqliteStatement
}

const READ_PREFIX = /^\s*(select|pragma|with)\b/i

/**
 * Adapt a `node-sqlite3-wasm` `Database` to the shape Kysely's `SqliteDialect`
 * expects. Kept minimal — used only by tests.
 */
export function adaptSqlite(db: Database): KyselySqliteDatabase {
  return {
    close: () => db.close(),
    prepare: (sqlStr: string): KyselySqliteStatement => {
      const reader = READ_PREFIX.test(sqlStr)
      return {
        reader,
        all: params => db.all(sqlStr, params as never) as unknown[],
        run: params => {
          const info = db.run(sqlStr, params as never)
          return { changes: info.changes, lastInsertRowid: info.lastInsertRowid }
        },
        iterate: params =>
          (db.all(sqlStr, params as never) as unknown[])[
            Symbol.iterator
          ]() as IterableIterator<unknown>,
      }
    },
  }
}
