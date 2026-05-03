import { conduit } from '@repliql/conduit/shared'
import {
  BridgedDriver,
  type DriverBridgeRemote,
  replayCreateCallbackFunction,
} from '@repliql/kysely-driver-bridge/shared'
import { ReactiveKysely } from '@repliql/reactive-kysely'
import { repliqlExchange, type DatabaseSchema } from '@repliql/repliql'
import { SharedExchangeService } from '@repliql/shared-exchange/shared'
import { SharedServicesManager } from '@repliql/shared-service/shared'
import { expose } from 'comlink'
import { SqliteAdapter, SqliteIntrospector, SqliteQueryCompiler } from 'kysely'

import { resolvers } from './resolvers'

const { wrapDedicatedWorker, onConnectTab, events } = conduit({
  logger: {
    level: 'error',
    ...console,
  },
})

const remoteBridge = wrapDedicatedWorker<DriverBridgeRemote>() as DriverBridgeRemote
const createCallbackFunction = replayCreateCallbackFunction({ events })

const kysely = new ReactiveKysely<DatabaseSchema>({
  dialect: {
    createDriver: () => new BridgedDriver(remoteBridge),
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

const sharedServices = new SharedServicesManager({
  services: {
    kyselyDriverBridge: {
      onConnectTab() {
        return remoteBridge
      },
    },
    sharedExchange: new SharedExchangeService({ exchange: repliql }),
  },
  logger: {
    ...console,
    level: 'debug',
  },
})

onConnectTab(port => {
  expose(sharedServices.connector, port)
})
