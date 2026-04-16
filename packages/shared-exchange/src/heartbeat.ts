import type { Heartbeat } from './types'

export function getLockName(heartbeatId: string): string {
  return `shared-exchange-heartbeat-${heartbeatId}`
}

export const heartbeat: Heartbeat = {
  start: heartbeatId => {
    return new Promise((resolve, reject) => {
      void navigator.locks
        .request(getLockName(heartbeatId), () => {
          resolve()
          // Never resolving promise = heart beats forever
          return new Promise(() => undefined)
        })
        .catch(reject)
    })
  },

  onStop: (heartbeatId, callback) => {
    void navigator.locks.request(getLockName(heartbeatId), () => {
      void callback()
      return Promise.resolve()
    })
  },
}
