/**
 * Liveness signal used to detect tab death.
 *
 * The default implementation is built on the [Web Locks API]: each tab holds a
 * named lock for its lifetime; the shared worker requests the same lock and
 * awaits its release as the death signal. Custom implementations can plug in
 * any other mechanism (e.g. timer-based heartbeats) for tests or non-browser
 * runtimes.
 *
 * [Web Locks API]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API
 */
export interface Heartbeat {
  /**
   * Acquire the heartbeat for `id`. Resolves once the lock is held; the
   * underlying lock is released when the tab unloads.
   */
  start: (id: string) => Promise<void>
  /**
   * Invoke `callback` once the tab holding `id` has released its heartbeat
   * (i.e. the tab has died or unloaded).
   */
  onStop: (id: string, callback: () => void) => void
}

/**
 * Default `Heartbeat` backed by `navigator.locks`. The tab takes a lock and
 * never resolves the lock callback, so the lock is held for the tab's
 * lifetime. The shared worker calls `onStop` to register a death listener
 * implemented as a competing lock request.
 */
export const heartbeat: Heartbeat = {
  start: lockId => {
    return new Promise((resolve, reject) => {
      void navigator.locks
        .request(lockId, () => {
          resolve()
          // Never resolving promise = heart beats forever (until tab dies)
          return new Promise(() => undefined)
        })
        .catch(reject)
    })
  },

  onStop: (lockId, callback) => {
    void navigator.locks.request(lockId, () => {
      void callback()
      return Promise.resolve()
    })
  },
}
