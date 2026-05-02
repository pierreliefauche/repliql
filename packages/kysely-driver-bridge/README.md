# @repliql/kysely-driver-bridge

> A Kysely driver for inter-process DB connections

Bridge a [Kysely driver](https://kysely-org.github.io/kysely-apidoc/interfaces/Driver.html) from one process to another. Enables using Kysely from a web tab with SQLite running in a shared/dedicated worker, or using Kysely from a shared worker with SQLite running in a dedicated worker.

## How It Works

[Comlink](https://www.npmjs.com/package/comlink) is used for inter-process communication. `@repliql/conduit` can be used to expose a leader DB running in a dedicated worker to a shared worker.

The package ships two halves:

- **`DriverBridge`** — lives in the worker that owns the real Kysely `Driver`. Exposes flat, Comlink-cloneable methods keyed by a `connectionId` string. Built from a factory `() => Driver`.
- **`BridgedDriver`** — lives in the consumer (tab or shared worker). Implements Kysely's `Driver` interface and forwards every call to a `Comlink.Remote<DriverBridge>`.

## Example: Access SQLite running in a shared worker from a main tab

**shared.worker.ts** — the shared worker process

```ts
import { DriverBridge } from '@repliql/kysely-driver-bridge/shared'
import * as Comlink from 'comlink'

const kyselyDialect = ... // instantiate a Kysely SQLite dialect however you please

const bridge = new DriverBridge(() => kyselyDialect.createDriver())

onconnect = e => Comlink.expose<DriverBridge>(bridge, e.ports[0])
```

**main.ts** — the main web tab

```ts
import { type DriverBridge, BridgedDriver } from '@repliql/kysely-driver-bridge/tab'
import { Kysely, SqliteAdapter, SqliteIntrospector, SqliteQueryCompiler } from 'kysely'
import * as Comlink from 'comlink'

const sharedWorker = new SharedWorker('shared.worker.ts')

const remoteBridge = Comlink.wrap<DriverBridge>(sharedWorker.port)

const db = new Kysely({
  dialect: {
    createDriver: () => new BridgedDriver(remoteBridge),
    createAdapter: () => new SqliteAdapter(),
    createIntrospector: db => new SqliteIntrospector(db),
    createQueryCompiler: () => new SqliteQueryCompiler(),
  },
})
```

## Example: Access SQLite running in a dedicated worker from a shared worker

**dedicated.worker.ts** — the dedicated worker running SQLite

```ts
import { DriverBridge } from '@repliql/kysely-driver-bridge/dedicated'
import { conduit } from '@repliql/conduit/dedicated'
import * as Comlink from 'comlink'

const kyselyDialect = ... // instantiate a Kysely SQLite dialect however you please

const bridge = new DriverBridge(() => kyselyDialect.createDriver())

conduit({
  onElectedLeader(port) {
    Comlink.expose(bridge, port)
  },
})
```

**shared.worker.ts** — the shared worker accessing the remote SQLite

```ts
import { conduit } from '@repliql/conduit/shared'
import { type DriverBridge, BridgedDriver } from '@repliql/kysely-driver-bridge/shared'
import { Kysely, SqliteAdapter, SqliteIntrospector, SqliteQueryCompiler } from 'kysely'

const { wrapDedicatedWorker } = conduit()

const remoteBridge = wrapDedicatedWorker<DriverBridge>()

const db = new Kysely({
  dialect: {
    createDriver: () => new BridgedDriver(remoteBridge, { forwardDestroy: true }),
    createAdapter: () => new SqliteAdapter(),
    createIntrospector: db => new SqliteIntrospector(db),
    createQueryCompiler: () => new SqliteQueryCompiler(),
  },
})
```

## Lifecycle and leader handover

When the consumer is the sole owner of the bridge (e.g. a single shared worker fronting one dedicated-worker leader), construct `BridgedDriver` with `{ forwardDestroy: true }` so `db.destroy()` tears down the underlying driver. In multi-consumer scenarios (many tabs sharing one worker), leave the option off and let the worker code own teardown explicitly.

In the shared→dedicated scenario, when the elected leader resigns:

- In-flight calls reject with `LeaderResignedError` (from `@repliql/conduit`). Active transactions fail — this is expected DB behavior when a connection is closed mid-transaction.
- Subsequent calls route to the new leader. Kysely's transaction `finally`-clause cleanup (`releaseConnection`, `rollbackTransaction`) hits the new leader with a stale id; `BridgedDriver` swallows the resulting `UnknownConnectionError` so the original `LeaderResignedError` surfaces unshadowed.
- `commitTransaction` errors are never swallowed.

## Limitations

- **`streamQuery`** throws `"not supported"`. Use `executeQuery` instead.
- **Savepoints / nested transactions** are not implemented (`savepoint`, `rollbackToSavepoint`, `releaseSavepoint`). Plain `db.transaction()` works; `trx.transaction()` does not.
- **`BridgedDriver#destroy()`** defaults to local cleanup only. Pass `{ forwardDestroy: true }` to forward to the worker-side driver.
- **`CompiledQuery.query` (the AST)** crosses the bridge via structured-clone, which preserves data fields but strips class prototypes. Kysely's tag-based `*Node.is(node)` checks (which read `node.kind`) still work; method calls on AST nodes do not. No driver in Kysely currently calls methods on AST nodes.
