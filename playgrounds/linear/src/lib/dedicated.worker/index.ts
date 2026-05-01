import { conduit } from '@repliql/conduit/dedicated'
import { DriverBridge } from '@repliql/kysely-driver-bridge/dedicated'
import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import { expose } from 'comlink'
import { OfficialWasmDialect, type OfficialWasmDB } from 'kysely-wasm'

conduit({
  onElectedLeader: async port => {
    const createDbPromise = Promise.resolve().then(async () => {
      const sqlite3 = await sqlite3InitModule()
      const PoolUtil = await sqlite3.installOpfsSAHPoolVfs({})
      if (!('OpfsSAHPoolDb' in PoolUtil)) {
        // This happens when you try to initialize WASM SQLite in a second tab.
        // Our SharedWorker architecture ensures this never happens.
        // If we see this error in Splunk or Sentry, something must have changed
        // and we should figure out what conditions causes this.
        throw PoolUtil
      }

      const db = new PoolUtil.OpfsSAHPoolDb(`/database.sqlite3`)

      return db
    })

    const dialect = new OfficialWasmDialect({
      database: () => createDbPromise as Promise<OfficialWasmDB>,
    })

    const bridge = new DriverBridge({
      createDriver: dialect.createDriver,
      createCallbackFunction: async (name: string, cb: (...args: unknown[]) => void) => {
        const db = await createDbPromise

        db.createFunction({
          name,
          arity: -1, // allow any number of args
          xFunc: (_ctx, ...args) => {
            cb(...args)
            return null
          },
        })
      },
    })

    expose(bridge, port)
  },
})
