import { conduit } from '@repliql/conduit/tab'
import type { DriverBridgeRemote } from '@repliql/kysely-driver-bridge/shared'
import type { SharedExchange } from '@repliql/shared-exchange/tab'
import { wrapSharedServices, type SharedServicesConnector } from '@repliql/shared-service/tab'
import { wrap } from 'comlink'

const { sharedWorker } = conduit({
  loadWorker: () =>
    new Worker(new URL('./dedicated.worker/index.ts', import.meta.url), {
      type: 'module',
      name: 'linear-sqlite',
    }),
  loadSharedWorker: () =>
    new SharedWorker(new URL('./shared.worker/index.ts', import.meta.url), {
      type: 'module',
      name: 'linear-repliql',
    }),
  logger: {
    level: 'error',
    ...console,
  },
})

const sharedServicesConnector = wrap<SharedServicesConnector>(sharedWorker.port)

export const sharedServices = wrapSharedServices<{
  kyselyDriverBridge: DriverBridgeRemote
  sharedExchange: SharedExchange
}>(sharedServicesConnector, {
  logger: {
    ...console,
    level: 'debug',
  },
})
