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

      // console.log('[dedicated worker] Creating function')
      // db.createFunction({
      //   name: 'myfun',
      //   arity: -1, // allow any number of args
      //   xFunc: (_ctx, ...args) => {
      //     console.log('[dedicated worker] Called function with args', args)
      //     return null
      //   },
      // })

      return db
    })

    const dialect = new OfficialWasmDialect({
      database: () => createDbPromise as Promise<OfficialWasmDB>,
    })

    console.log('[dedicated worker] Did create database, creating driver bridge')

    const bridge = new DriverBridge(dialect.createDriver)

    const createCallbackFunction = async (opts: {
      name: string
      cb: (...args: unknown[]) => void
    }) => {
      console.log('[dedicated worker] Creating function', opts.name)
      const db = await createDbPromise

      db.createFunction({
        name: opts.name,
        arity: -1, // allow any number of args
        xFunc: (_ctx, ...args) => {
          opts.cb(...args)
          return null
        },
      })
    }

    console.log('[dedicated worker] Did create bridge, exposing to shared worker')

    expose(Object.assign(bridge, { createCallbackFunction }), port)

    console.log('[dedicated worker] Did expose bridge to shared port')
  },
})
