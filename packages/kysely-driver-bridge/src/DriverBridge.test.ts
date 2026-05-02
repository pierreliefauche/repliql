import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import {
  type CompiledQuery,
  type DatabaseConnection,
  type Driver,
  Kysely,
  type QueryResult,
  SqliteDialect,
  sql,
  type TransactionSettings,
} from 'kysely'
import { Database } from 'node-sqlite3-wasm'

import { BridgedConnection } from './BridgedConnection'
import { BridgedDriver } from './BridgedDriver'
import { DriverBridge } from './DriverBridge'
import { adaptSqlite } from './test-utils/adaptSqlite'

class FakeConnection implements DatabaseConnection {
  public executed: CompiledQuery[] = []
  async executeQuery<R>(q: CompiledQuery): Promise<QueryResult<R>> {
    this.executed.push(q)
    return { rows: [] as R[] }
  }
  streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
    throw new Error('not used')
  }
}

class FakeDriver implements Driver {
  public initCount = 0
  public initShouldFail = false
  public destroyCount = 0
  public connections: FakeConnection[] = []
  public released: FakeConnection[] = []
  public txCalls: { kind: string; conn: FakeConnection; settings?: TransactionSettings }[] = []

  async init() {
    this.initCount++
    if (this.initShouldFail) {
      this.initShouldFail = false
      throw new Error('init failed')
    }
  }
  async acquireConnection() {
    const c = new FakeConnection()
    this.connections.push(c)
    return c
  }
  async releaseConnection(c: DatabaseConnection) {
    this.released.push(c as FakeConnection)
  }
  async beginTransaction(c: DatabaseConnection, settings: TransactionSettings) {
    this.txCalls.push({ kind: 'begin', conn: c as FakeConnection, settings })
  }
  async commitTransaction(c: DatabaseConnection) {
    this.txCalls.push({ kind: 'commit', conn: c as FakeConnection })
  }
  async rollbackTransaction(c: DatabaseConnection) {
    this.txCalls.push({ kind: 'rollback', conn: c as FakeConnection })
  }
  async destroy() {
    this.destroyCount++
  }
}

describe('DriverBridge — unit', () => {
  it('memoizes init across parallel callers', async () => {
    const driver = new FakeDriver()
    const bridge = new DriverBridge(() => driver)

    await Promise.all([bridge.init(), bridge.init(), bridge.init()])

    expect(driver.initCount).toBe(1)
  })

  it('clears the init memo on rejection so a retry can succeed', async () => {
    const driver = new FakeDriver()
    driver.initShouldFail = true
    const bridge = new DriverBridge(() => driver)

    await expect(bridge.init()).rejects.toThrow('init failed')
    await bridge.init()

    expect(driver.initCount).toBe(2)
  })

  it('acquireConnection returns distinct ids and tracks connections', async () => {
    const driver = new FakeDriver()
    const bridge = new DriverBridge(() => driver)

    const a = await bridge.acquireConnection()
    const b = await bridge.acquireConnection()

    expect(a).not.toBe(b)
    expect(typeof a).toBe('string')
    expect(driver.connections).toHaveLength(2)
  })

  it('executeQuery on unknown id throws UnknownConnectionError (by name)', async () => {
    const driver = new FakeDriver()
    const bridge = new DriverBridge(() => driver)
    await bridge.init()

    let caught: unknown
    try {
      await bridge.executeQuery('does-not-exist', {
        sql: 'select 1',
        parameters: [],
        query: {} as never,
      })
    } catch (err) {
      caught = err
    }
    expect((caught as { name?: string }).name).toBe('UnknownConnectionError')
  })

  it('routes transaction methods to the right connection', async () => {
    const driver = new FakeDriver()
    const bridge = new DriverBridge(() => driver)
    const id = await bridge.acquireConnection()

    await bridge.beginTransaction(id, { isolationLevel: 'serializable' })
    await bridge.commitTransaction(id)
    await bridge.rollbackTransaction(id)

    expect(driver.txCalls.map(c => c.kind)).toEqual(['begin', 'commit', 'rollback'])
    expect(driver.txCalls[0]!.settings).toEqual({ isolationLevel: 'serializable' })
    expect(driver.txCalls.every(c => c.conn === driver.connections[0])).toBe(true)
  })

  it('releaseConnection drops the id; subsequent operations throw UnknownConnectionError', async () => {
    const driver = new FakeDriver()
    const bridge = new DriverBridge(() => driver)
    const id = await bridge.acquireConnection()

    await bridge.releaseConnection(id)
    expect(driver.released).toHaveLength(1)

    let caught: unknown
    try {
      await bridge.commitTransaction(id)
    } catch (err) {
      caught = err
    }
    expect((caught as { name?: string }).name).toBe('UnknownConnectionError')
  })

  it('destroy tears down the underlying driver', async () => {
    const driver = new FakeDriver()
    const bridge = new DriverBridge(() => driver)
    await bridge.init()

    await bridge.destroy()

    expect(driver.destroyCount).toBe(1)
  })
})

describe('DriverBridge — integration with real SQLite', () => {
  let sqlite: Database
  let bridge: DriverBridge
  let kysely: Kysely<{ widgets: { id: number; name: string } }>

  beforeEach(async () => {
    sqlite = new Database(':memory:')
    const adapted = adaptSqlite(sqlite)
    bridge = new DriverBridge(() => new SqliteDialect({ database: adapted }).createDriver())

    // Build a Kysely instance whose dialect uses BridgedDriver pointed at the in-process bridge.
    // We borrow the dialect's adapter / introspector / compiler from a throwaway SqliteDialect.
    const reference = new SqliteDialect({ database: adapted })
    kysely = new Kysely({
      dialect: {
        createDriver: () => new BridgedDriver(bridge),
        createAdapter: () => reference.createAdapter(),
        createIntrospector: db => reference.createIntrospector(db),
        createQueryCompiler: () => reference.createQueryCompiler(),
      },
    })

    await sql`CREATE TABLE widgets (id INTEGER PRIMARY KEY, name TEXT)`.execute(kysely)
  })

  afterEach(async () => {
    await kysely.destroy()
    await bridge.destroy()
  })

  it('runs CRUD end-to-end through the bridge', async () => {
    await kysely.insertInto('widgets').values({ id: 1, name: 'alpha' }).execute()
    await kysely.insertInto('widgets').values({ id: 2, name: 'beta' }).execute()

    const rows = await kysely.selectFrom('widgets').selectAll().orderBy('id').execute()
    expect(rows).toEqual([
      { id: 1, name: 'alpha' },
      { id: 2, name: 'beta' },
    ])
  })

  it('commits a transaction and persists the rows', async () => {
    await kysely.transaction().execute(async trx => {
      await trx.insertInto('widgets').values({ id: 1, name: 'committed' }).execute()
    })
    const rows = await kysely.selectFrom('widgets').selectAll().execute()
    expect(rows).toEqual([{ id: 1, name: 'committed' }])
  })

  it('rolls back a transaction and discards the rows', async () => {
    await expect(
      kysely.transaction().execute(async trx => {
        await trx.insertInto('widgets').values({ id: 1, name: 'rolled-back' }).execute()
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')

    const rows = await kysely.selectFrom('widgets').selectAll().execute()
    expect(rows).toEqual([])
  })

  it('BridgedConnection carries its bridge-issued id', async () => {
    const driver = new BridgedDriver(bridge)
    await driver.init()
    const conn = await driver.acquireConnection()
    expect(conn).toBeInstanceOf(BridgedConnection)
    expect(typeof (conn as BridgedConnection).id).toBe('string')
    await driver.releaseConnection(conn)
    await driver.destroy()
  })
})
