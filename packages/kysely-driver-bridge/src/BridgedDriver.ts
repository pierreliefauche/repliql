import type { DatabaseConnection, Driver, TransactionSettings } from 'kysely'

import { BridgedConnection } from './BridgedConnection'
import { isErrorWithName } from './errors'
import type { BridgedDriverOptions, DriverBridgeRemote } from './types'

/**
 * Consumer-side Kysely `Driver`. Wraps a `Comlink.Remote<DriverBridge>` (or
 * any object satisfying `DriverBridgeRemote`) and forwards every call to the
 * worker that owns the real driver.
 *
 * Cleanup-error policy: `releaseConnection` and `rollbackTransaction` swallow
 * `UnknownConnectionError` (detected by `name`, since Comlink loses the
 * prototype chain across `postMessage`). After a leader resign in the
 * shared→dedicated case, the in-flight call rejects with `LeaderResignedError`
 * and Kysely's `finally`-clause cleanup hits a fresh leader that doesn't know
 * the id; swallowing those keeps the original error from being shadowed.
 * `commitTransaction` stays strict — silently swallowing a commit error would
 * be data-corrupting.
 */
export class BridgedDriver implements Driver {
  #remote: DriverBridgeRemote | null
  readonly #forwardDestroy: boolean

  constructor(remote: DriverBridgeRemote, options: BridgedDriverOptions = {}) {
    this.#remote = remote
    this.#forwardDestroy = options.forwardDestroy === true
  }

  async init(): Promise<void> {
    await this.#requireRemote().init()
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    const remote = this.#requireRemote()
    const id = await remote.acquireConnection()
    return new BridgedConnection(id, remote)
  }

  async releaseConnection(connection: DatabaseConnection): Promise<void> {
    const id = (connection as BridgedConnection).id
    try {
      await this.#requireRemote().releaseConnection(id)
    } catch (err) {
      if (isErrorWithName(err, 'UnknownConnectionError')) {
        return
      }
      throw err
    }
  }

  async beginTransaction(
    connection: DatabaseConnection,
    settings: TransactionSettings,
  ): Promise<void> {
    const id = (connection as BridgedConnection).id
    await this.#requireRemote().beginTransaction(id, settings)
  }

  async commitTransaction(connection: DatabaseConnection): Promise<void> {
    const id = (connection as BridgedConnection).id
    await this.#requireRemote().commitTransaction(id)
  }

  async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    const id = (connection as BridgedConnection).id
    try {
      await this.#requireRemote().rollbackTransaction(id)
    } catch (err) {
      if (isErrorWithName(err, 'UnknownConnectionError')) {
        return
      }
      throw err
    }
  }

  async destroy(): Promise<void> {
    const remote = this.#remote
    this.#remote = null
    if (remote && this.#forwardDestroy) {
      await remote.destroy()
    }
  }

  #requireRemote(): DriverBridgeRemote {
    if (!this.#remote) {
      throw new Error('@repliql/kysely-driver-bridge: BridgedDriver has been destroyed')
    }
    return this.#remote
  }
}
