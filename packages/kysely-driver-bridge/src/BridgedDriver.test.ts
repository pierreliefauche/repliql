import { describe, expect, it, mock } from 'bun:test'

import type { CompiledQuery, DatabaseConnection, QueryResult, TransactionSettings } from 'kysely'

import { BridgedConnection } from './BridgedConnection'
import { BridgedDriver } from './BridgedDriver'
import type { DriverBridgeRemote } from './types'

function makeRemote(overrides: Partial<DriverBridgeRemote> = {}): DriverBridgeRemote {
  return {
    init: mock(async () => {}),
    acquireConnection: mock(async () => 'conn-1'),
    releaseConnection: mock(async () => {}),
    executeQuery: mock(async <R>() => ({ rows: [] as R[] })) as DriverBridgeRemote['executeQuery'],
    beginTransaction: mock(async () => {}),
    commitTransaction: mock(async () => {}),
    rollbackTransaction: mock(async () => {}),
    destroy: mock(async () => {}),
    ...overrides,
  }
}

const fakeQuery: CompiledQuery = { sql: 'select 1', parameters: [], query: {} as never }
const fakeSettings: TransactionSettings = { isolationLevel: 'serializable' }

describe('BridgedDriver', () => {
  it('acquireConnection returns a BridgedConnection that carries the remote id', async () => {
    const remote = makeRemote({ acquireConnection: mock(async () => 'abc-123') })
    const driver = new BridgedDriver(remote)

    const conn = await driver.acquireConnection()

    expect(conn).toBeInstanceOf(BridgedConnection)
    expect((conn as BridgedConnection).id).toBe('abc-123')
  })

  it('connection.executeQuery forwards id + query to the remote', async () => {
    const executeQuery = mock(async <R>() => ({
      rows: [{ x: 1 }] as R[],
    })) as DriverBridgeRemote['executeQuery']
    const remote = makeRemote({ executeQuery })
    const driver = new BridgedDriver(remote)
    const conn = (await driver.acquireConnection()) as BridgedConnection

    const result = await conn.executeQuery<{ x: number }>(fakeQuery)

    expect(result.rows).toEqual([{ x: 1 }])
    expect(executeQuery).toHaveBeenCalledWith(conn.id, fakeQuery)
  })

  it('streamQuery throws "not supported"', async () => {
    const driver = new BridgedDriver(makeRemote())
    const conn = (await driver.acquireConnection()) as BridgedConnection

    expect(() => conn.streamQuery<unknown>()).toThrow('streamQuery is not supported')
  })

  it('releaseConnection swallows UnknownConnectionError', async () => {
    const remote = makeRemote({
      releaseConnection: mock(async () => {
        const err = new Error('gone')
        ;(err as { name: string }).name = 'UnknownConnectionError'
        throw err
      }),
    })
    const driver = new BridgedDriver(remote)
    const conn = await driver.acquireConnection()

    // Must NOT throw.
    await driver.releaseConnection(conn)
  })

  it('rollbackTransaction swallows UnknownConnectionError', async () => {
    const remote = makeRemote({
      rollbackTransaction: mock(async () => {
        const err = new Error('gone')
        ;(err as { name: string }).name = 'UnknownConnectionError'
        throw err
      }),
    })
    const driver = new BridgedDriver(remote)
    const conn = await driver.acquireConnection()

    await driver.rollbackTransaction(conn)
  })

  it('commitTransaction does NOT swallow errors', async () => {
    const remote = makeRemote({
      commitTransaction: mock(async () => {
        throw new Error('commit broke')
      }),
    })
    const driver = new BridgedDriver(remote)
    const conn = await driver.acquireConnection()

    await expect(driver.commitTransaction(conn)).rejects.toThrow('commit broke')
  })

  it('releaseConnection re-throws non-UnknownConnectionError errors', async () => {
    const remote = makeRemote({
      releaseConnection: mock(async () => {
        throw new Error('something else')
      }),
    })
    const driver = new BridgedDriver(remote)
    const conn = await driver.acquireConnection()

    await expect(driver.releaseConnection(conn)).rejects.toThrow('something else')
  })

  it('beginTransaction forwards settings', async () => {
    const beginTransaction = mock(async () => {})
    const remote = makeRemote({ beginTransaction })
    const driver = new BridgedDriver(remote)
    const conn = (await driver.acquireConnection()) as BridgedConnection

    await driver.beginTransaction(conn, fakeSettings)

    expect(beginTransaction).toHaveBeenCalledWith(conn.id, fakeSettings)
  })

  describe('destroy()', () => {
    it('does NOT call remote.destroy() by default', async () => {
      const destroy = mock(async () => {})
      const remote = makeRemote({ destroy })
      const driver = new BridgedDriver(remote)

      await driver.destroy()

      expect(destroy).not.toHaveBeenCalled()
    })

    it('calls remote.destroy() exactly once when forwardDestroy is true', async () => {
      const destroy = mock(async () => {})
      const remote = makeRemote({ destroy })
      const driver = new BridgedDriver(remote, { forwardDestroy: true })

      await driver.destroy()

      expect(destroy).toHaveBeenCalledTimes(1)
    })

    it('throws on subsequent operations after destroy', async () => {
      const driver = new BridgedDriver(makeRemote())
      await driver.destroy()

      await expect(driver.acquireConnection()).rejects.toThrow('has been destroyed')
    })
  })

  it('init forwards to remote', async () => {
    const init = mock(async () => {})
    const driver = new BridgedDriver(makeRemote({ init }))

    await driver.init()

    expect(init).toHaveBeenCalledTimes(1)
  })
})

// Exhaustiveness placeholder so static checks can flag DatabaseConnection / QueryResult drift.
const _typeCheck: DatabaseConnection | QueryResult<unknown> | null = null
void _typeCheck
