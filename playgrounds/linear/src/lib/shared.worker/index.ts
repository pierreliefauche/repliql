import { conduit } from '@repliql/conduit/shared'
import {
  BridgedDriver,
  type DriverBridgeRemote,
  replayCreateCallbackFunction,
} from '@repliql/kysely-driver-bridge/shared'
import { ReactiveKysely } from '@repliql/reactive-kysely'
import { repliqlExchange, type DatabaseSchema } from '@repliql/repliql'
import { SharedService } from '@repliql/shared-exchange'
import { expose } from 'comlink'
import { SqliteAdapter, SqliteIntrospector, SqliteQueryCompiler } from 'kysely'

import { resolvers } from './resolvers'

const { wrapDedicatedWorker, onConnectTab, events } = conduit()

const remoteBridge = wrapDedicatedWorker<DriverBridgeRemote>()
const createCallbackFunction = replayCreateCallbackFunction({ events })

const kysely = new ReactiveKysely<DatabaseSchema>({
  dialect: {
    createDriver: () => new BridgedDriver(remoteBridge as DriverBridgeRemote),
    createAdapter: () => new SqliteAdapter(),
    createIntrospector: db => new SqliteIntrospector(db),
    createQueryCompiler: () => new SqliteQueryCompiler(),
  },
  createCallbackFunction,
  queryUpdateDebounceMs: 0,
})

const repliql = repliqlExchange({
  kysely,
  resolvers,
})

// Create the exchange (cache, logging, auth, or any custom exchange)
const sharedService = new SharedService({
  exchange: repliql,
})

onConnectTab(port => {
  expose(sharedService, port)
})
