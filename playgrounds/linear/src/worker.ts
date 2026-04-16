import { SharedService, exposeSharedService } from '@repliql/shared-exchange'
import { cacheExchange } from 'urql'

console.log('cross', self.crossOriginIsolated)

const service = new SharedService({ exchange: cacheExchange })
exposeSharedService(service)

// DB

import { Kysely } from 'kysely'
import type { Generated } from 'kysely'
import { SQLocalKysely } from 'sqlocal/kysely'

const { dialect } = new SQLocalKysely('database.sqlite3')
export const db = new Kysely<Database>({ dialect })

export type Database = {
  groceries: GroceriesTable
}

export type GroceriesTable = {
  id: Generated<number>
  name: string
  quantity: number
}

Promise.resolve().then(async () => {
  console.log('init db')

  await db.schema
    .createTable('groceries')
    .ifNotExists()
    .addColumn('id', 'integer', col => col.autoIncrement().primaryKey())
    .addColumn('name', 'text')
    .addColumn('quantity', 'integer')
    .execute()

  await db.introspection.getTables().then(console.log).catch(console.error)
})
