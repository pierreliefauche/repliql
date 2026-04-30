import { ReactiveKysely } from '@repliql/reactive-kysely'
import { type DatabaseSchema } from '@repliql/repliql'
import { sql } from 'kysely'
import { SQLocalKysely } from 'sqlocal/kysely'

// DB

const { dialect, createCallbackFunction } = new SQLocalKysely('database.sqlite3')

export const kysely = new ReactiveKysely<DatabaseSchema>({
  dialect,
  createCallbackFunction,
  queryUpdateDebounceMs: 0,
})

export async function dumpDatabase(): Promise<Record<string, unknown[]>> {
  const tables = await kysely.introspection.getTables()
  const dump: Record<string, unknown[]> = {}
  await Promise.all(
    tables.map(async ({ name }) => {
      dump[name] = await sql<unknown>`select * from ${sql.ref(name)}`
        .execute(kysely)
        .then(r => r.rows)
    }),
  )
  console.group(
    `%cdatabase dump%c (${tables.length} tables)`,
    'font-weight: bold; color: #6ea8fe',
    'color: gray',
  )
  for (const [name, rows] of Object.entries(dump)) {
    console.groupCollapsed(
      `%c${name}%c  ${rows.length} row${rows.length === 1 ? '' : 's'}`,
      'font-weight: bold',
      'color: gray',
    )
    if (rows.length > 0) {
      console.table(rows)
      // console.groupCollapsed('raw')
      // console.log(rows)
      // console.groupEnd()
    }
    console.groupEnd()
  }
  console.groupEnd()
  return dump
}

// debug
// @ts-ignore
self.kysely = kysely
// @ts-ignore
self.dumpDatabase = dumpDatabase

// SQLite viewer in Chrome inspector
import { SqliteClientExtension } from '@magieno/sqlite-client'
SqliteClientExtension.register('scripts/sqlite-worker.mjs')
