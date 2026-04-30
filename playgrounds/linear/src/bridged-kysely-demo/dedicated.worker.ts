import { conduit } from '@repliql/conduit/dedicated'
import { DriverBridge } from '@repliql/kysely-driver-bridge/dedicated'
import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import { expose } from 'comlink'
import { OfficialWasmDialect, type OfficialWasmDB } from 'kysely-wasm'

console.log('[dedicated worker] Initiating conduit')

conduit({
  onElectedLeader: async port => {
    console.log('[dedicated worker] I am elected leader, creating dialect')

    const createDbPromise = Promise.resolve().then(async () => {
      console.log('[dedicated worker] Will create database')

      const sqlite3 = await sqlite3InitModule()
      const PoolUtil = await sqlite3.installOpfsSAHPoolVfs({})
      if (!('OpfsSAHPoolDb' in PoolUtil)) {
        // This happens when you try to initialize WASM SQLite in a second tab.
        // Our SharedWorker architecture ensures this never happens.
        // If we see this error in Splunk or Sentry, something must have changed
        // and we should figure out what conditions causes this.
        throw PoolUtil
      }

      const db = new PoolUtil.OpfsSAHPoolDb(`/bridged.sqlite3`)

      console.log('[dedicated worker] Did create database')

      return db
    })

    const dialect = new OfficialWasmDialect({
      database: () => createDbPromise as Promise<OfficialWasmDB>,
    })

    console.log('[dedicated worker] Did create database, creating driver bridge')

    const bridge = new DriverBridge({
      createDriver: dialect.createDriver,
      createCallbackFunction: async (name: string, cb: (...args: unknown[]) => void) => {
        console.log('[dedicated worker] Creating function', name)
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

    console.log('[dedicated worker] Did create bridge, exposing to shared worker')

    expose(bridge, port)

    console.log('[dedicated worker] Did expose bridge to shared port')
  },
})
