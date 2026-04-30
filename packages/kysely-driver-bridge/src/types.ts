import type { CompiledQuery, QueryResult, TransactionSettings } from 'kysely'

export type CreateCallbackFunctionFn = (
  fnName: string,
  cb: (...args: any[]) => void,
) => void | Promise<void>

/**
 * Structural type matching the surface that `BridgedDriver` calls on the
 * remote `DriverBridge`. Compatible with both a local `DriverBridge` instance
 * and a `Comlink.Remote<DriverBridge>`. Declared structurally so this package
 * does not need a runtime dependency on `comlink`.
 */
export type DriverBridgeRemote = {
  createCallbackFunction: CreateCallbackFunctionFn
  init(): Promise<void>
  acquireConnection(): Promise<string>
  releaseConnection(connectionId: string): Promise<void>
  executeQuery<R>(connectionId: string, query: CompiledQuery): Promise<QueryResult<R>>
  beginTransaction(connectionId: string, settings: TransactionSettings): Promise<void>
  commitTransaction(connectionId: string): Promise<void>
  rollbackTransaction(connectionId: string): Promise<void>
  destroy(): Promise<void>
}

export interface BridgedDriverOptions {
  /**
   * If true, `BridgedDriver.destroy()` forwards to `remote.destroy()`,
   * tearing down the worker-side underlying driver. Defaults to `false`.
   *
   * Use only when the consumer is the sole owner of the bridge (e.g. one
   * shared worker fronting one dedicated-worker leader). In multi-consumer
   * setups (e.g. many tabs sharing a worker), leave this off — the worker
   * code should drive teardown explicitly.
   */
  forwardDestroy?: boolean
}
