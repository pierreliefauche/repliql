# @repliql/repliql

> Offline-first cache and local database extension for [URQL](https://formidable.com/open-source/urql/)

`@repliql/repliql` is a URQL exchange that replaces document-cache or normalized cache solutions with a SQLite-backed, offline-first cache. Queries are resolved locally against a [`ReactiveKysely`](https://www.npmjs.com/package/@repliql/reactive-kysely) database, mutations can be optimistic and replayed against the network, and live results re-emit as the underlying data changes.

## Install

```bash
npm install @repliql/repliql @urql/core kysely wonka
# or
bun add @repliql/repliql @urql/core kysely wonka
```

[`@urql/core`](https://www.npmjs.com/package/@urql/core), [`kysely`](https://www.npmjs.com/package/kysely), and [`wonka`](https://www.npmjs.com/package/wonka) are required peer dependencies.

## Use cases

- Large datasets you want to query and filter locally
- Offline support with data persistence
- Auto-suggest, auto-completion against cached data
- Data shared between tabs / windows
- Apps like calendars, mail clients, project management tools

## Exchanges

### `repliqlExchange`

The main exchange. Resolves queries from a local SQLite database, persists results from the network, runs optimistic mutations, and re-emits operations whose result is invalidated by row changes.

```ts
import { repliqlExchange } from '@repliql/repliql'
import { ReactiveKysely } from '@repliql/reactive-kysely'
import { Client, fetchExchange } from '@urql/core'

const kysely = new ReactiveKysely({
  dialect: /* SQLite dialect */,
  createCallbackFunction: (name, cb) => { /* register SQLite UDF */ },
})

const client = new Client({
  url: '/graphql',
  exchanges: [
    repliqlExchange({
      kysely,
      resolvers: {
        Query: {
          itemById: (_parent, { id }) => ({ __typename: 'Item', id }),
        },
        Mutation: {
          updateItem: async (_parent, { input }, ctx) => {
            return ctx.patchEntity({ __typename: 'Item', ...input })
          },
        },
      },
    }),
    fetchExchange,
  ],
})
```

Key behaviors:

- **Local resolution** — operations are executed against the cache via field/mutation resolvers. Resolvers receive a context with `entityByRef`, `queryById`, `filterEntityPointers`, and (for mutations) `patchEntity`.
- **Live updates** — the exchange tracks which entities/queries each operation visits; when a row update touches a tracked entity or query, the operation is re-executed with `cache-only`.
- **Network fallback** — cache misses, errored local results, and `cache-and-network` / `network-only` policies are forwarded to the next exchange. Successful network results are persisted back to the database.
- **Optimistic mutations** — `patchEntity` writes optimistic entities into the cache and a background `MutationsProcessor` reconciles them with the server response.

### `fastCacheExchange`

In-memory result registry keyed by URQL operation key. Returns the last seen result synchronously for repeat queries while the slower normalized cache catches up.
Use it in tabs for synchronous results while authoritative query is running asynchronously in SQLite.

```ts
import { fastCacheExchange } from '@repliql/repliql'

fastCacheExchange({ eviction: { strategy: 'delayed', delayMs: 60_000 } })
```

### `coldStartExchange`

Persists query results to OPFS so the next page load can answer queries before the database is ready.

```ts
import { coldStartExchange } from '@repliql/repliql'

coldStartExchange({
  directory: 'repliql-cold-start',
  flushDelayMs: 2_000,
  sweepDelayMs: 120_000,
})
```

## Recommended exchange order

```ts
exchanges: [
  fastCacheExchange({ eviction: { strategy: 'delayed', delayMs: 60_000 } }),
  coldStartExchange(),
  repliqlExchange({ kysely, resolvers }),
  fetchExchange,
]
```

## Status

Early development. The public API is experimental and may change between minor versions.

## License

MIT
