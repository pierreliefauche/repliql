import { conduit } from '@repliql/conduit/shared'
import { BridgedDriver, type DriverBridgeRemote } from '@repliql/kysely-driver-bridge/shared'
import { expose, proxy } from 'comlink'
import { Kysely, SqliteAdapter, SqliteIntrospector, SqliteQueryCompiler, sql } from 'kysely'

console.log('[shared worker] Initiating conduit')

const { wrapDedicatedWorker, onConnectTab } = conduit()

console.log('[shared worker] Did init conduit, will wrap dedicated worker')

const remoteBridge = wrapDedicatedWorker<
  DriverBridgeRemote & {
    createCallbackFunction: (args: { name: string; cb: (...args: unknown[]) => void }) => void
  }
>()

console.log('[shared worker] Did wrap dedicated worker into bridge, will init Kysely')

const db = new Kysely({
  dialect: {
    createDriver: () => new BridgedDriver(remoteBridge as DriverBridgeRemote),
    createAdapter: () => new SqliteAdapter(),
    createIntrospector: db => new SqliteIntrospector(db),
    createQueryCompiler: () => new SqliteQueryCompiler(),
  },
})

console.log('[shared worker] Creating callback function')

remoteBridge.createCallbackFunction(
  proxy({
    name: 'tellme',
    cb: (...args) => {
      console.log('[shared worker] Callback function called', ...args)
    },
  }),
)

console.log(
  '[shared worker] Did init Kysely, expose as globalThis.db and expose executeSql(q: string)',
)

onConnectTab(port => {
  expose(remoteBridge, port)
})

// @ts-ignore
globalThis.db = db

// @ts-ignore
globalThis.executeSql = function (rawSql: string) {
  sql
    .raw(rawSql)
    .execute(db)
    .then(r => console.log('Results:', r))
    .catch(e => console.log('Error:', e))
}
