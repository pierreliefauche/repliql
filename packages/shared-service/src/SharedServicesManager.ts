import { heartbeat as navigatorHeartbeat, makeLogger, type Logger } from '@repliql/utils'

import { getHeartbeatId } from './getHeartbeatId'
import type { Heartbeat, Service, SharedServiceMap, SharedServicesManagerConfig } from './types'

export class SharedServicesManager<TServices extends Record<string, Service>> {
  private readonly services: SharedServiceMap<TServices>
  private readonly heartbeat: Heartbeat
  private readonly log: Logger

  constructor({
    services,
    heartbeat: _heartbeat,
    logger: loggerConfig,
  }: SharedServicesManagerConfig<TServices>) {
    this.log = makeLogger({ ...loggerConfig, prefix: `[SharedService] [shared]` })

    if (_heartbeat) {
      this.heartbeat = _heartbeat
    } else if (typeof navigator !== 'undefined' && typeof navigator.locks !== 'undefined') {
      this.heartbeat = navigatorHeartbeat
    } else {
      throw new Error(
        'SharedServicesManager requires a heartbeat in environments without navigator.locks. Pass SharedServicesManagerConfig.heartbeat explicitly.',
      )
    }

    this.services = services

    this.log.debug('Created SharedServicesManager', { services: Object.keys(services) })
  }

  public get connector() {
    const proxy = {
      connect: (tabId: string) => {
        const instances = {} as TServices
        for (const name of Object.keys(this.services) as Array<keyof TServices>) {
          instances[name] = this.services[name].onConnectTab(tabId) as TServices[keyof TServices]
        }

        // Replace proxy with services
        Object.assign(proxy, { connect: undefined, ...instances })

        this.heartbeat.onStop(getHeartbeatId(tabId), () => {
          this.log.debug('Tab heartbeat stopped', { tabId })
          for (const name of Object.keys(this.services) as Array<keyof TServices>) {
            this.services[name].onDisconnectTab?.(tabId, instances[name])
          }
        })
      },
    }

    return proxy
  }
}
