export type Heartbeat = {
  start: (id: string) => Promise<void>
  onStop: (id: string, callback: () => void) => void
}

export function getLockName(id: string): string {
  return `conduit-tab-${id}`
}

export const heartbeat: Heartbeat = {
  start: id => {
    return new Promise((resolve, reject) => {
      void navigator.locks
        .request(getLockName(id), () => {
          resolve()
          // Never resolving promise = heart beats forever (until tab dies)
          return new Promise(() => undefined)
        })
        .catch(reject)
    })
  },

  onStop: (id, callback) => {
    void navigator.locks.request(getLockName(id), () => {
      void callback()
      return Promise.resolve()
    })
  },
}
