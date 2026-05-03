import { SharedServicesManager } from '@repliql/shared-service/shared'
import * as Comlink from 'comlink'

const onlineTabs = new Set<string>()

const manager = new SharedServicesManager({
  services: {
    timer: {
      onConnectTab() {
        return {
          delay(ms, cb) {
            setTimeout(() => {
              cb(ms)
            }, ms)
          },
        }
      },
    },
    counter: {
      onConnectTab() {
        let n = 0
        return {
          inc: () => ++n,
          get: () => n,
        }
      },
    },
    presence: {
      onConnectTab(tabId) {
        onlineTabs.add(tabId)
        console.log('[shared-service demo] tab connected:', tabId, '→', [...onlineTabs])
        return {
          list: () => [...onlineTabs],
          whoAmI: () => tabId,
        }
      },
      onDisconnectTab(tabId) {
        onlineTabs.delete(tabId)
        console.log('[shared-service demo] tab disconnected:', tabId, '→', [...onlineTabs])
      },
    },
  },
  logger: {
    ...console,
    level: 'debug',
  },
})

;(self as unknown as SharedWorkerGlobalScope).onconnect = e => {
  Comlink.expose(manager.connector, e.ports[0])
}
