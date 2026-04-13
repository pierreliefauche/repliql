# @repliql/reactive-kysely

> Turn a [Kysely](https://github.com/kysely-org/kysely) query into a **subscription mask** — a static description of which rows could change its result, so you know when to re-run it.

## Install

```bash
npm install @repliql/reactive-kysely
# or
bun add @repliql/reactive-kysely
```

Kysely `^0.28.16` is a peer dependency.

## API

### `queryToSubscriptionMask(query)`

Inspects a Kysely query (without executing it) and returns a `QueryMask` describing:

- **`select`** — which tables/columns the query projects
- **`matchers`** — predicates over rows that, if matched, mean this query's result may have changed

```typescript
import { queryToSubscriptionMask } from '@repliql/reactive-kysely'

const q = db
  .selectFrom('users')
  .select(['id', 'name'])
  .where('age', '>', 18)
  .where('name', '=', 'John')

queryToSubscriptionMask(q)
// {
//   operation: 'select',
//   select: {
//     type: 'narrow',
//     tables: {
//       users: {
//         type: 'narrow',
//         columns: { id: { type: 'all' }, name: { type: 'all' } },
//       },
//     },
//   },
//   matchers: [
//     {
//       type: 'narrow',
//       table: 'users',
//       match: {
//         type: 'narrow',
//         columns: {
//           age: { type: 'all' },
//           name: { type: 'values', values: ['John'] },
//         },
//       },
//     },
//   ],
// }
```

Write queries return the operation type and target table:

```typescript
queryToSubscriptionMask(db.insertInto('users').values({ ... }))
// { operation: 'insert', table: 'users' }

queryToSubscriptionMask(db.updateTable('users').set({ name: 'Jane' }).where('id', '=', 1))
// { operation: 'update', table: 'users' }

queryToSubscriptionMask(db.deleteFrom('users').where('id', '=', 1))
// { operation: 'delete', table: 'users' }
```

## How it works

`queryToSubscriptionMask` calls `toOperationNode()` on the query builder and walks Kysely's internal AST. No database connection or query compilation is needed.

The WHERE clause is normalized to **disjunctive normal form** (OR of ANDs), and each disjunct is emitted as one or more matchers. A change to any row satisfying any matcher is a signal that the query's result may have changed.

### Matcher shape

```typescript
MaskMatcher =
  | { type: 'all' }                             // any row anywhere
  | { type: 'narrow', table: T, match: Table }  // row of a specific table

MaskMatcherTable =
  | { type: 'all' }                             // any row of the table
  | { type: 'narrow', columns: { [col]: ColumnMatcher } }

MaskMatcherColumn =
  | { type: 'all' }                             // any value
  | { type: 'values', values: unknown[] }       // from = or IN
  | { type: 'fields', fields: { ... } }         // JSON field match
```

### Coverage

- **`=` and `IN`** produce `{ type: 'values', values: [...] }`. Other operators (`>`, `<`, `like`, …) widen to `{ type: 'all' }`.
- **Table aliases** (`users as u`) are resolved to real names. **Column aliases** (`id as uid`) are unwrapped.
- **JOINs**: inner/cross joins are mandatory — a change to a joined row can add/remove outer rows even without projection. Left/right/full joins don't count as mandatory.
- **No WHERE clause**: falls back to a wide matcher on every projected / mandatory-joined table.
- **HAVING**: adds a wide branch covering every queried table.
- **NOT X**: keeps column references but widens their value predicates.
- **Subqueries in WHERE**: recursively analyzed; their read-matchers are merged into the outer result.
- **Subqueries in FROM** and **CTEs**: absorbed — their selection/matchers are inlined, and outer references to the alias don't leak into the mask.
- **Raw SQL** or unrecognized predicates: conservatively widen to cover all queried tables.

## Types

```typescript
import type {
  QueryMask,
  ReadQueryMask,
  WriteQueryMask,
  MaskMatcher,
} from '@repliql/reactive-kysely'
```

## License

MIT
