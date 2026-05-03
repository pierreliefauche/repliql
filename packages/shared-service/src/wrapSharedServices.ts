import { heartbeat as navigatorHeartbeat, makeLogger, randomId } from '@repliql/utils'
import type { Remote } from 'comlink'

import { getHeartbeatId } from './getHeartbeatId'
import type {
  Heartbeat,
  LoggerConfig,
  RemoteServices,
  Service,
  SharedServicesConnector,
} from './types'

interface WrapOptions {
  heartbeat?: Heartbeat
  logger?: LoggerConfig
}

/**
 * Wraps a Comlink-proxied `SharedServicesManager` into per-service remote
 * proxies. The hub connection is established lazily on the first method call;
 * subsequent calls reuse the same connection and tab ID. Each method call is
 * dispatched through `manager.invoke(serviceName, tabId, method, args)`.
 */
export function wrapSharedServices<TServices extends Record<string, Service>>(
  managerConnector: Remote<SharedServicesConnector>,
  options: WrapOptions = {},
): RemoteServices<TServices> {
  const log = makeLogger({ ...options.logger, prefix: `[SharedService] [tab]` })
  const heartbeat = options.heartbeat ?? navigatorHeartbeat
  const tabId = randomId()

  log.debug('Connecting to shared services manager', { tabId })
  const ensureConnected = Promise.resolve().then(async () => {
    await heartbeat.start(getHeartbeatId(tabId))
    await managerConnector.connect(tabId)
    log.debug('Services are ready')
  })

  return new Proxy({} as RemoteServices<TServices>, {
    get(_, _serviceName) {
      if (typeof _serviceName === 'symbol') {
        log.warn('Cannot access services proxy with symbol property')
        return undefined
      }

      const service = _serviceName as keyof TServices

      return new Proxy(
        {},
        {
          get(_inner, _method: string) {
            if (typeof _method === 'symbol') {
              log.warn('Cannot access service method with symbol property', { service })
              return undefined
            }

            const method = _method as keyof TServices[typeof service]

            return (...args: unknown[]) => {
              log.debug('Invoking', { tabId, service, method })
              return ensureConnected.then(() =>
                (managerConnector as RemoteServices<TServices>)[service][method](...args),
              )
            }
          },
        },
      )
    },
  })
}
