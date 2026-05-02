import type { CompiledQuery, DatabaseConnection, QueryResult } from 'kysely'

import type { DriverBridgeRemote } from './types'

/**
 * Consumer-side `DatabaseConnection` that carries its bridge-issued id and
 * forwards `executeQuery` to the remote `DriverBridge`. Held by reference by
 * Kysely's transaction machinery, so `releaseConnection`/`commit`/`rollback`
 * can read `connection.id`.
 */
export class BridgedConnection implements DatabaseConnection {
  public readonly id: string
  readonly #remote: DriverBridgeRemote

  constructor(id: string, remote: DriverBridgeRemote) {
    this.id = id
    this.#remote = remote
  }

  executeQuery<R>(query: CompiledQuery): Promise<QueryResult<R>> {
    return this.#remote.executeQuery<R>(this.id, query)
  }

  streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
    throw new Error('streamQuery is not supported by @repliql/kysely-driver-bridge')
  }
}
