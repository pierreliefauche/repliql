# @repliql/utils

> Shared utilities for the [RepliQL](https://github.com/Pierre-Elie/repliql) monorepo — hashing, stable serialization, GraphQL execution, URQL operation helpers, and more.

Tree-shakable: every export lives in its own module and the package is marked `"sideEffects": false`, so bundlers drop whatever you don't import.

## Install

```bash
npm install @repliql/utils
# or
bun add @repliql/utils
```

No peer dependencies — all runtime dependencies ([`@0no-co/graphql.web`](https://www.npmjs.com/package/@0no-co/graphql.web), [`@urql/core`](https://www.npmjs.com/package/@urql/core), [`wonka`](https://www.npmjs.com/package/wonka), [`@solana/fast-stable-stringify`](https://www.npmjs.com/package/@solana/fast-stable-stringify), [`strict-event-emitter`](https://www.npmjs.com/package/strict-event-emitter)) are bundled as regular dependencies.

## What's inside

### Primitives & equality

- **`isPrimitive(value)` / `Primitive`** — type guard for `string | number | boolean | bigint | null | undefined`.
- **`areEqual(a, b)`** — structural equality for primitives, plain objects, and arrays.
- **`phash(value)` / `HashValue`** — fast non-cryptographic hash, suitable for cache keys.
- **`stableStringify(value)`** — deterministic `JSON.stringify` (keys sorted) re-exported from [`@solana/fast-stable-stringify`](https://www.npmjs.com/package/@solana/fast-stable-stringify). Equal values always produce equal strings.
- **`randomId()`** — short non-cryptographic random identifier.

```ts
import { phash, stableStringify } from '@repliql/utils'

const key = phash(stableStringify({ b: 1, a: 2 }))
```

### Reactive helpers

- **`SourceMap`** — a `Map`-like cache of [`wonka`](https://www.npmjs.com/package/wonka) `Source`s that creates and shares streams on demand.
- **`EventEmitter`** — a tiny strictly-typed event emitter (re-exporting [`strict-event-emitter`](https://www.npmjs.com/package/strict-event-emitter) semantics).

### Logging

- **`makeLogger({ prefix?, level? })`** — leveled `debug` / `info` / `warn` / `error` logger with prefix support. Honors a configurable level threshold.

### Heartbeat

- **`heartbeat`** — Web Locks-based heartbeat, used by [`@repliql/conduit`](https://www.npmjs.com/package/@repliql/conduit) and [`@repliql/shared-service`](https://www.npmjs.com/package/@repliql/shared-service) for tab-death detection.

### GraphQL

- **`execute({ compiled, variableValues, fieldResolver, context })`** / **`compile(document)`** — minimal GraphQL executor with custom field resolvers, no schema required.
- **`FieldResolver`**, **`ResolveInfo`**, **`ExecutionResult`**, **`CompiledOperation`** — types for the executor.
- **`transformQueryData(...)`** — walk a query's response shape and rewrite values per field.
- **`getFullFieldName({ name, args })`** — stable string identity for a field+args pair, suitable for caching.
- **Entity helpers** — `Entity`, `EntityRef`, `EntityPointer`, `getEntityRef`, `isEntityHandle` and friends for normalized-cache style entity addressing (`__typename` + `id`).

### URQL helpers

- **`makeOperationsRegistry({ kinds, eviction, onAdd })`** — registry that tracks live URQL operations and evicts them based on a strategy (`immediate` or `delayed`).
- **`ensureOperationId(ops$)`** — operator that stamps an `OperationHandle` onto every operation passing through.
- **`getOperationHandle(operation)` / `OperationHandle`** — stable cross-process identifier for a URQL operation.
- **`mapTypeNames(operation)`** — adds `__typename` selections to outgoing queries.
- **`getCacheOutcome(result)` / `setCacheOutcome(result, 'hit' | 'miss')`** — read/write a cache-outcome marker on `OperationResult`.

## Usage

```ts
import {
  ensureOperationId,
  getOperationHandle,
  makeOperationsRegistry,
  setCacheOutcome,
} from '@repliql/utils'
```

Each helper is documented at its source module — most are small, focused functions that compose into the higher-level packages in the RepliQL monorepo.

## Status

Internal utility package for RepliQL. APIs may change between minor versions.

## License

MIT
