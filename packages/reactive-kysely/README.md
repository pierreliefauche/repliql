# @repliql/reactive-kysely

> **Reactive queries for [`kysely`](https://www.npmjs.com/package/kysely)** — live-updating query results that automatically re-emit when underlying data changes.

## Install

```bash
npm install @repliql/reactive-kysely kysely
# or
bun add @repliql/reactive-kysely kysely
```

[`kysely`](https://www.npmjs.com/package/kysely) is a peer dependency. [`react`](https://www.npmjs.com/package/react) is an optional peer dependency required only if you import `@repliql/reactive-kysely/react`:

```bash
npm install @repliql/reactive-kysely kysely react
```

## Quick Start

```typescript
import { ReactiveKysely } from '@repliql/reactive-kysely'
import { SqliteDialect } from 'kysely'
import { pipe, subscribe } from 'wonka'

// Create a reactive database instance
const db = new ReactiveKysely<DB>({
  dialect: new SqliteDialect({ database }),
  createCallbackFunction: (name, cb) => {
    // Register SQLite callback function (implementation depends on your driver)
    database.function(name, (oldJson, newJson) => {
      cb(oldJson, newJson)
      return null
    })
  },
})

// Create a live query that re-emits when data changes
const source = db.liveQuery(db.selectFrom('users').select(['id', 'name']).where('age', '>', 18))

// Subscribe to updates
pipe(
  source,
  subscribe(users => {
    console.log('Users:', users)
  }),
)

// When you insert/update/delete data, subscribers automatically receive updates
await db.insertInto('users').values({ id: 1, name: 'Alice', age: 25 }).execute()
// Console: Users: [{ id: 1, name: 'Alice' }]
```

## API

### `ReactiveKysely`

A Kysely subclass that adds reactive query capabilities.

```typescript
const db = new ReactiveKysely<DB>({
  // Standard Kysely config
  dialect: new SqliteDialect({ database }),

  // Required: function to register SQLite callback functions for triggers
  createCallbackFunction: (name, callback) => { ... },

  // Optional: default debounce for query re-execution (default: 10ms)
  queryUpdateDebounceMs: 10,
})
```

#### `liveQuery(query, options?)`

Returns a [`wonka`](https://www.npmjs.com/package/wonka) `Source<Result[]>` that:

1. Emits the initial query result on subscription
2. Re-emits when data changes that could affect the result
3. Deduplicates by result hash (no re-emit if data unchanged)

```typescript
const source = db.liveQuery(
  db.selectFrom('users').selectAll().where('active', '=', true),
  { debounceMs: 50 }, // Optional: override default debounce
)
```

### `queryToChangeSubscription(query)`

Inspects a Kysely SELECT query (without executing it) and returns a `ChangeSubscription<DB>` describing which row changes could affect the result. Returns `undefined` for write queries.

```typescript
import { queryToChangeSubscription } from '@repliql/reactive-kysely'

const q = db
  .selectFrom('users')
  .select(['id', 'name'])
  .where('age', '>', 18)
  .where('name', '=', 'John')

queryToChangeSubscription(q)
// {
//   selection: {
//     users: { id: true, name: true }
//   },
//   filter: {
//     users: [{ age: '*', name: { $in: ['John'] } }]
//   }
// }
```

## ChangeSubscription structure

A `ChangeSubscription<DB>` has two parts:

- **`selection`** — which tables/columns the query projects
- **`filter`** — predicates over rows that, if matched, mean the query result may have changed

```typescript
type ChangeSubscription<DB> = {
  filter:
    | '*' // Match any row from any table
    | {
        [Table]?:
          | '*' // Match any row from this table
          | ColumnFilter[] // OR-array of column predicates
      }
  selection:
    | true // Select all columns from all tables
    | {
        [Table]?:
          | true // Select all columns from this table
          | {
              [Column]?: true | { [field]: true } // Specific columns or JSON fields
            }
      }
}
```

### Column filter values

- `'*'` — match any value (from `>`, `<`, `like`, etc.)
- `{ $in: [...] }` — match specific values (from `=` or `IN`)
- `{ $nin: [...] }` — exclude specific values (from `!=`, `<>`, or `NOT IN`)
- `{ [field]: '*' | { $in: [...] } | { $nin: [...] } }` — JSON field matching

## How it works

### Query analysis

`queryToChangeSubscription` calls `toOperationNode()` on the query builder and walks Kysely's internal AST. No database connection or query compilation is needed.

The WHERE clause is normalized to **disjunctive normal form** (OR of ANDs), and each disjunct is emitted as a filter entry. A change to any row satisfying any filter is a signal that the query's result may have changed.

### Change detection

`ReactiveKysely` uses SQLite triggers to detect changes:

1. On first query for a table, creates INSERT/UPDATE/DELETE triggers
2. Triggers invoke registered callback functions with old/new row JSON
3. Row updates are checked against compiled subscriptions
4. Matching changes trigger query re-execution
5. Results are deduplicated by hash before emission

### Coverage

- **`=` and `IN`** produce `{ $in: [...] }`. **`!=`, `<>`, and `NOT IN`** produce `{ $nin: [...] }`. Other operators (`>`, `<`, `like`, …) widen to `'*'`.
- **Table aliases** (`users as u`) are resolved to real names. **Column aliases** (`id as uid`) are unwrapped.
- **JOINs**: inner/cross joins are mandatory — a change to a joined row can add/remove outer rows. Left/right/full joins don't count as mandatory.
- **No WHERE clause**: falls back to a wide filter on every projected / mandatory-joined table.
- **HAVING**: adds a wide branch covering every queried table.
- **NOT X**: keeps column references but widens their value predicates.
- **Subqueries in WHERE**: recursively analyzed; their filters are merged into the outer result.
- **Subqueries in FROM** and **CTEs**: absorbed — their selection/filters are inlined.
- **ORDER BY columns**: tracked in selection (changes can affect result ordering).
- **JSON fields** (`column->>'field'`): tracked at field level when possible.
- **Raw SQL** or unrecognized predicates: conservatively widen to cover all queried tables.

## Types

```typescript
import type { ChangeSubscription, RowUpdate, ReactiveKyselyConfig } from '@repliql/reactive-kysely'

import { MATCH_ALL } from '@repliql/reactive-kysely'
```

## License

MIT
