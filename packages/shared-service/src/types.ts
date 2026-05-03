import type { Heartbeat, LoggerConfig } from '@repliql/utils'
import type { Remote } from 'comlink'

export type { Heartbeat, LoggerConfig }

export type Service = Record<string, (...args: any[]) => any>

/**
 * A service registered with a `SharedServicesManager`. The hub creates a fresh
 * `T` per connecting tab via `onConnectTab` and tears it down via `onDisconnectTab`.
 */
export interface SharedService<T extends Service> {
  onConnectTab: (tabId: string) => T
  onDisconnectTab?: (tabId: string, instance: T) => void
}

export type SharedServiceMap<TServices extends Record<string, Service>> = {
  [K in keyof TServices]: SharedService<TServices[K]>
}

export interface SharedServicesManagerConfig<TServices extends Record<string, Service>> {
  services: SharedServiceMap<TServices>
  heartbeat?: Heartbeat
  logger?: LoggerConfig
}

export interface SharedServicesConnector {
  connect: (tabId: string) => void
}

export type RemoteService<Service> = Remote<Service>

/**
 * Spoke-side view of the registered services. Each method returns a Promise
 * because calls cross a Comlink boundary.
 */
export type RemoteServices<TServices extends Record<string, Service>> = {
  [K in keyof TServices]: RemoteService<TServices[K]>
}
