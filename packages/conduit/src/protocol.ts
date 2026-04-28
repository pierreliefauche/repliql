export const SDW_DEDICATED_PORT = 'dedicated-port' as const

export interface DedicatedPortMessage {
  __sdw: typeof SDW_DEDICATED_PORT
  port: MessagePort
}

export function isDedicatedPortMessage(data: unknown): data is DedicatedPortMessage {
  if (typeof data !== 'object' || data === null) {
    return false
  }
  const msg = data as Partial<DedicatedPortMessage>
  return msg.__sdw === SDW_DEDICATED_PORT && msg.port instanceof MessagePort
}

export class LeaderResignedError extends Error {
  constructor(message: string = 'Leader resigned during call') {
    super(message)
    this.name = 'LeaderResignedError'
  }
}

/** Shape of the broker-registration sub-API exposed by the shared worker. */
export interface BrokerApi {
  registerTab(tabId: string, port: MessagePort): void
  unregisterTab(tabId: string): void
}
