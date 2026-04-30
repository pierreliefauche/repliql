import { randomId } from '@repliql/utils'
import type {
  CompiledQuery,
  DatabaseConnection,
  Driver,
  QueryResult,
  TransactionSettings,
} from 'kysely'

import { UnknownConnectionError } from './errors'

/**
 * Worker-side half of the bridge. Holds a lazily-initialized Kysely `Driver`
 * and a map of `connectionId -> DatabaseConnection`. Exposes flat,
 * Comlink-cloneable methods keyed by id so a peer `BridgedDriver` in another
 * process can drive it through `Comlink.expose` / `Comlink.wrap`.
 */
export class DriverBridge {
  readonly #createDriver: () => Driver
  #driver: Driver | null = null
  #initPromise: Promise<void> | null = null
  readonly #connections = new Map<string, DatabaseConnection>()

  constructor(createDriver: () => Driver) {
    this.#createDriver = createDriver
  }

  /**
   * Initializes the underlying driver. Idempotent: parallel callers share one
   * underlying init. If init rejects, the memo is cleared so a subsequent
   * call retries (matching Kysely `RuntimeDriver.init` behavior).
   */
  init(): Promise<void> {
    if (this.#initPromise) {
      return this.#initPromise
    }

    const promise = (async () => {
      const driver = this.#createDriver()
      await driver.init()
      this.#driver = driver
    })()

    this.#initPromise = promise
    promise.catch(() => {
      if (this.#initPromise === promise) {
        this.#initPromise = null
        this.#driver = null
      }
    })

    return promise
  }

  async acquireConnection(): Promise<string> {
    const driver = await this.#requireDriver()
    const connection = await driver.acquireConnection()
    const id = randomId()
    this.#connections.set(id, connection)
    return id
  }

  async releaseConnection(connectionId: string): Promise<void> {
    const connection = this.#connections.get(connectionId)
    if (!connection) {
      throw new UnknownConnectionError(connectionId)
    }
    this.#connections.delete(connectionId)
    const driver = await this.#requireDriver()
    await driver.releaseConnection(connection)
  }

  async executeQuery<R>(connectionId: string, query: CompiledQuery): Promise<QueryResult<R>> {
    const connection = this.#requireConnection(connectionId)
    return connection.executeQuery<R>(query)
  }

  async beginTransaction(connectionId: string, settings: TransactionSettings): Promise<void> {
    const connection = this.#requireConnection(connectionId)
    const driver = await this.#requireDriver()
    await driver.beginTransaction(connection, settings)
  }

  async commitTransaction(connectionId: string): Promise<void> {
    const connection = this.#requireConnection(connectionId)
    const driver = await this.#requireDriver()
    await driver.commitTransaction(connection)
  }

  async rollbackTransaction(connectionId: string): Promise<void> {
    const connection = this.#requireConnection(connectionId)
    const driver = await this.#requireDriver()
    await driver.rollbackTransaction(connection)
  }

  /**
   * Tears down the underlying driver. Intended to be called by the worker
   * code that owns the bridge — NOT by consumer-side `BridgedDriver.destroy()`
   * unless the consumer was constructed with `{ forwardDestroy: true }`.
   */
  async destroy(): Promise<void> {
    const driver = this.#driver
    this.#connections.clear()
    this.#driver = null
    this.#initPromise = null
    if (driver) {
      await driver.destroy()
    }
  }

  async #requireDriver(): Promise<Driver> {
    if (!this.#driver) {
      await this.init()
    }
    if (!this.#driver) {
      throw new Error('@repliql/kysely-driver-bridge: driver failed to initialize')
    }
    return this.#driver
  }

  #requireConnection(connectionId: string): DatabaseConnection {
    const connection = this.#connections.get(connectionId)
    if (!connection) {
      throw new UnknownConnectionError(connectionId)
    }
    return connection
  }
}
