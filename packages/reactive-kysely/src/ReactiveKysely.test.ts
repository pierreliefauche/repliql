import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import {
  type CompiledQuery,
  Kysely,
  type QueryResult,
  SqliteDialect,
  sql,
  type SqlBool,
} from 'kysely'
import { Database } from 'node-sqlite3-wasm'
import { pipe, subscribe, type Source, type Subscription } from 'wonka'

import { ReactiveKysely } from './ReactiveKysely'

interface Users {
  id: number
  name: string
  age: number
  metadata: string | null
}

interface Posts {
  id: number
  user_id: number
  title: string
}

interface DB {
  users: Users
  posts: Posts
}

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

function adaptDatabase(db: Database): KyselySqliteDatabase & {
  function: Database['function']
} {
  return {
    close: () => db.close(),
    function: (name, fn, options) => db.function(name, fn, options),
    prepare: (sqlStr: string): KyselySqliteStatement => {
      const reader = READ_PREFIX.test(sqlStr)
      return {
        reader,
        all: params => db.all(sqlStr, params as any) as unknown[],
        run: params => {
          const info = db.run(sqlStr, params as any)
          return { changes: info.changes, lastInsertRowid: info.lastInsertRowid }
        },
        iterate: params =>
          (db.all(sqlStr, params as any) as unknown[])[
            Symbol.iterator
          ]() as IterableIterator<unknown>,
      }
    },
  }
}

class InstrumentedReactiveKysely<DBT> extends ReactiveKysely<DBT> {
  public executeQueryCount = 0
  override executeQuery<R>(
    query: CompiledQuery<R> | Parameters<Kysely<DBT>['executeQuery']>[0],
    queryId?: any,
  ): Promise<QueryResult<R>> {
    this.executeQueryCount++
    return super.executeQuery(query as any, queryId)
  }
}

function collect<T>(source: Source<T>): { emissions: T[]; unsubscribe: () => void } {
  const emissions: T[] = []
  const sub: Subscription = pipe(
    source,
    subscribe(v => {
      emissions.push(v)
    }),
  )
  return { emissions, unsubscribe: () => sub.unsubscribe() }
}

const flush = async () => {
  await new Promise(r => setTimeout(r, 0))
  await new Promise(r => setTimeout(r, 0))
}

let sqlite: Database
let adapted: ReturnType<typeof adaptDatabase>
let db: InstrumentedReactiveKysely<DB>
let callbacksRegistered: number

beforeEach(async () => {
  sqlite = new Database(':memory:')
  adapted = adaptDatabase(sqlite)
  callbacksRegistered = 0
  db = new InstrumentedReactiveKysely<DB>({
    dialect: new SqliteDialect({ database: adapted }),
    createCallbackFunction: (name, cb) => {
      callbacksRegistered++
      adapted.function(name, (oldJson: any, newJson: any) => {
        cb(oldJson, newJson)
        return null
      })
    },
  })
  await sql`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER, metadata TEXT)`.execute(
    db,
  )
  await sql`CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER, title TEXT)`.execute(db)
})

afterEach(async () => {
  await db.destroy()
})

describe('ReactiveKysely — basic lifecycle', () => {
  it('emits the initial result then re-emits on insert', async () => {
    const { emissions, unsubscribe } = collect(db.liveQuery(db.selectFrom('users').selectAll()))
    await flush()
    expect(emissions).toEqual([[]])

    await db.insertInto('users').values({ id: 1, name: 'alice', age: 30, metadata: null }).execute()
    await flush()
    expect(emissions).toHaveLength(2)
    expect(emissions[1]).toEqual([{ id: 1, name: 'alice', age: 30, metadata: null }])

    unsubscribe()
  })

  it('re-emits on update', async () => {
    await db.insertInto('users').values({ id: 1, name: 'alice', age: 30, metadata: null }).execute()
    const { emissions, unsubscribe } = collect(db.liveQuery(db.selectFrom('users').selectAll()))
    await flush()

    await db.updateTable('users').set({ age: 31 }).where('id', '=', 1).execute()
    await flush()

    expect(emissions).toHaveLength(2)
    expect(emissions[1]).toEqual([{ id: 1, name: 'alice', age: 31, metadata: null }])
    unsubscribe()
  })

  it('re-emits on delete', async () => {
    await db.insertInto('users').values({ id: 1, name: 'alice', age: 30, metadata: null }).execute()
    const { emissions, unsubscribe } = collect(db.liveQuery(db.selectFrom('users').selectAll()))
    await flush()

    await db.deleteFrom('users').where('id', '=', 1).execute()
    await flush()

    expect(emissions).toHaveLength(2)
    expect(emissions[1]).toEqual([])
    unsubscribe()
  })

  it('does not re-emit when the result set is unchanged (hash dedup)', async () => {
    await db.insertInto('users').values({ id: 1, name: 'alice', age: 30, metadata: null }).execute()
    const { emissions, unsubscribe } = collect(
      db.liveQuery(db.selectFrom('users').selectAll().where('id', '=', 1)),
    )
    await flush()
    expect(emissions).toHaveLength(1)

    await db.insertInto('users').values({ id: 2, name: 'bob', age: 25, metadata: null }).execute()
    await flush()
    expect(emissions).toHaveLength(1)

    unsubscribe()
  })

  it('registers exactly one set of triggers per table on first watch', async () => {
    const { unsubscribe } = collect(db.liveQuery(db.selectFrom('users').selectAll()))
    await flush()

    const triggers = sqlite.all(
      "SELECT name FROM sqlite_master WHERE type = 'trigger' ORDER BY name",
    ) as { name: string }[]
    expect(triggers.map(t => t.name)).toEqual([
      'repliql_delete_users',
      'repliql_insert_users',
      'repliql_update_users',
    ])
    expect(callbacksRegistered).toBe(1)

    unsubscribe()
  })
})

describe('ReactiveKysely — sharing and dedup across listeners', () => {
  it('installs triggers only once across multiple subscribers on the same table', async () => {
    const a = collect(db.liveQuery(db.selectFrom('users').selectAll()))
    const b = collect(db.liveQuery(db.selectFrom('users').select(['id', 'name'])))
    await flush()

    const userTriggerCount = (
      sqlite.get(
        "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'repliql_%_users'",
      ) as { n: number }
    ).n
    expect(userTriggerCount).toBe(3)
    expect(callbacksRegistered).toBe(1)

    a.unsubscribe()
    b.unsubscribe()
  })

  it('blocks refetch when the mutation is filtered out by the ChangeSubscription', async () => {
    await db.insertInto('users').values({ id: 1, name: 'alice', age: 30, metadata: null }).execute()
    const { unsubscribe } = collect(db.liveQuery(db.selectFrom('posts').selectAll()))
    await flush()

    db.executeQueryCount = 0
    await db.updateTable('users').set({ age: 31 }).where('id', '=', 1).execute()
    await flush()

    expect(db.executeQueryCount).toBe(0)
    unsubscribe()
  })

  it('stops refetching after unsubscribe', async () => {
    await db.insertInto('users').values({ id: 1, name: 'alice', age: 30, metadata: null }).execute()
    const { unsubscribe } = collect(db.liveQuery(db.selectFrom('users').selectAll()))
    await flush()

    db.executeQueryCount = 0
    await db.updateTable('users').set({ age: 31 }).where('id', '=', 1).execute()
    await flush()
    const countWhileSubscribed = db.executeQueryCount
    expect(countWhileSubscribed).toBeGreaterThan(0)

    unsubscribe()

    db.executeQueryCount = 0
    await db.updateTable('users').set({ age: 32 }).where('id', '=', 1).execute()
    await flush()
    expect(db.executeQueryCount).toBe(0)
  })

  it('shares refetch work between two subscribers of the same liveQuery Source', async () => {
    await db.insertInto('users').values({ id: 1, name: 'alice', age: 30, metadata: null }).execute()

    const liveSource = db.liveQuery(db.selectFrom('users').selectAll())
    const a = collect(liveSource)
    const b = collect(liveSource)
    await flush()

    db.executeQueryCount = 0
    await db.updateTable('users').set({ age: 31 }).where('id', '=', 1).execute()
    await flush()

    expect(db.executeQueryCount).toBe(1)
    expect(a.emissions.at(-1)).toEqual([{ id: 1, name: 'alice', age: 31, metadata: null }])
    expect(b.emissions.at(-1)).toEqual([{ id: 1, name: 'alice', age: 31, metadata: null }])

    a.unsubscribe()
    b.unsubscribe()
  })

  it('shares refetch work between two separate liveQuery calls with identical SQL', async () => {
    await db.insertInto('users').values({ id: 1, name: 'alice', age: 30, metadata: null }).execute()

    const a = collect(db.liveQuery(db.selectFrom('users').selectAll()))
    const b = collect(db.liveQuery(db.selectFrom('users').selectAll()))
    await flush()

    db.executeQueryCount = 0
    await db.updateTable('users').set({ age: 31 }).where('id', '=', 1).execute()
    await flush()

    expect(db.executeQueryCount).toBe(1)
    expect(a.emissions.at(-1)).toEqual([{ id: 1, name: 'alice', age: 31, metadata: null }])
    expect(b.emissions.at(-1)).toEqual([{ id: 1, name: 'alice', age: 31, metadata: null }])

    a.unsubscribe()
    b.unsubscribe()
  })
})

describe('ReactiveKysely — advanced queries (JSON fields)', () => {
  it('re-emits when a JSON-projected column changes', async () => {
    await db
      .insertInto('users')
      .values({
        id: 1,
        name: 'alice',
        age: 30,
        metadata: JSON.stringify({ name: 'Alice', tier: 'free' }),
      })
      .execute()

    const query = db
      .selectFrom('users')
      .select(['id', sql<string>`json_extract(metadata, '$.name')`.as('extracted_name')])

    const { emissions, unsubscribe } = collect(db.liveQuery(query))
    await flush()
    expect(emissions[0]).toEqual([{ id: 1, extracted_name: 'Alice' }])

    await db
      .updateTable('users')
      .set({ metadata: JSON.stringify({ name: 'Alicia', tier: 'free' }) })
      .where('id', '=', 1)
      .execute()
    await flush()

    expect(emissions.at(-1)).toEqual([{ id: 1, extracted_name: 'Alicia' }])
    unsubscribe()
  })

  it('filters rows with a JSON predicate in WHERE and re-emits on tier flips', async () => {
    await db
      .insertInto('users')
      .values({
        id: 1,
        name: 'alice',
        age: 30,
        metadata: JSON.stringify({ tier: 'pro' }),
      })
      .execute()
    await db
      .insertInto('users')
      .values({
        id: 2,
        name: 'bob',
        age: 25,
        metadata: JSON.stringify({ tier: 'free' }),
      })
      .execute()

    // Use selectAll so the change-subscription's per-column selection covers
    // `metadata`; otherwise isChangeSubscriptionUpdate's `selectionChanged` check
    // only inspects selected columns and misses a tier flip in JSON.
    const query = db
      .selectFrom('users')
      .selectAll()
      .where(sql<SqlBool>`json_extract(metadata, '$.tier') = 'pro'`)

    const { emissions, unsubscribe } = collect(db.liveQuery(query))
    await flush()
    expect(emissions[0]).toEqual([
      { id: 1, name: 'alice', age: 30, metadata: JSON.stringify({ tier: 'pro' }) },
    ])

    await db
      .updateTable('users')
      .set({ metadata: JSON.stringify({ tier: 'pro' }) })
      .where('id', '=', 2)
      .execute()
    await flush()
    expect(emissions.at(-1)).toEqual([
      { id: 1, name: 'alice', age: 30, metadata: JSON.stringify({ tier: 'pro' }) },
      { id: 2, name: 'bob', age: 25, metadata: JSON.stringify({ tier: 'pro' }) },
    ])

    await db
      .updateTable('users')
      .set({ metadata: JSON.stringify({ tier: 'free' }) })
      .where('id', '=', 1)
      .execute()
    await flush()
    expect(emissions.at(-1)).toEqual([
      { id: 2, name: 'bob', age: 25, metadata: JSON.stringify({ tier: 'pro' }) },
    ])

    unsubscribe()
  })

  it('conservatively refetches on any users change when WHERE uses raw JSON', async () => {
    await db
      .insertInto('users')
      .values({
        id: 1,
        name: 'alice',
        age: 30,
        metadata: JSON.stringify({ tier: 'pro' }),
      })
      .execute()

    const query = db
      .selectFrom('users')
      .select('age')
      .where(sql<SqlBool>`json_extract(metadata, '$.tier') = 'pro'`)

    const { unsubscribe } = collect(db.liveQuery(query))
    await flush()

    db.executeQueryCount = 0
    await db.updateTable('users').set({ age: 31 }).where('id', '=', 1).execute()
    await flush()
    expect(db.executeQueryCount).toBe(1)

    unsubscribe()
  })

  it('does NOT conservatively refetches on any users change when WHERE uses raw JSON IF the selection has not changed', async () => {
    await db
      .insertInto('users')
      .values({
        id: 1,
        name: 'alice',
        age: 30,
        metadata: JSON.stringify({ tier: 'pro' }),
      })
      .execute()

    const query = db
      .selectFrom('users')
      .select(['id', 'name', 'metadata'])
      .where(sql<SqlBool>`json_extract(metadata, '$.tier') = 'pro'`)

    const { unsubscribe } = collect(db.liveQuery(query))
    await flush()

    db.executeQueryCount = 0
    await db.updateTable('users').set({ age: 31 }).where('id', '=', 1).execute()
    await flush()
    expect(db.executeQueryCount).toBe(0)

    unsubscribe()
  })
})
