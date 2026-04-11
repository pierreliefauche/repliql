# @repliql/kysely-dissect-query

> Static analysis utilities for [Kysely](https://github.com/kysely-org/kysely) queries

## Install

```bash
npm install @repliql/kysely-dissect-query
# or
bun add @repliql/kysely-dissect-query
```

Kysely `^0.28.16` is a peer dependency.

## API

### `dissectQuery(query)`

Inspect a Kysely query to find out which tables and columns it touches, without executing it.

Returns a `DissectedReadQuery` for selects or a `DissectedWriteQuery` for inserts, updates, and deletes.

```typescript
import { dissectQuery } from '@repliql/kysely-dissect-query'

const q = db
  .selectFrom('users')
  .innerJoin('posts', 'posts.user_id', 'users.id')
  .select(['users.id', 'posts.title'])
  .where('age', '>', 18)
  .where('users.name', '=', 'John')
  .where('posts.tag', 'in', ['news', 'archive'])

dissectQuery(q)
// {
//   operation: 'select',
//   tables: {
//     users: {
//       columns: {
//         id: { selected: true },
//         name: { selected: false, eq: ['John'] },
//       },
//     },
//     posts: {
//       columns: {
//         title: { selected: true },
//         tag: { selected: false, eq: ['news', 'archive'] },
//       },
//     },
//   },
//   unidentifiedTable: {
//     columns: {
//       age: { selected: false, unknownOperator: true },
//     },
//   },
// }
```

Write queries return the operation type and target table:

```typescript
dissectQuery(db.insertInto('users').values({ ... }))
// { operation: 'insert', table: 'users' }

dissectQuery(db.updateTable('users').set({ name: 'Jane' }).where('id', '=', 1))
// { operation: 'update', table: 'users' }

dissectQuery(db.deleteFrom('users').where('id', '=', 1))
// { operation: 'delete', table: 'users' }
```

## How it works

`dissectQuery` calls `toOperationNode()` on the query builder and walks Kysely's internal AST. No database connection or query compilation is needed.

For each column it encounters, the result tracks:

| Field             | Meaning                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `selected`        | `true` if the column appears in the `SELECT` clause                                                                       |
| `eq`              | Concrete values from `=` or `IN` filters                                                                                  |
| `unknownOperator` | `true` when filtered by an operator other than `=` / `in`, or when values can't be statically extracted (e.g. subqueries) |

### Column resolution

Qualified references (`users.id`) are placed under the corresponding table. Unqualified references (`age`) are resolved to the table when there is only one; otherwise they go to `unidentifiedTable`.

Table aliases (`users as u`) and column aliases (`users.id as uid`) are resolved back to the real names.

### `selectAll`

`selectAll()` sets `unidentifiedColumn: true` on the relevant tables. `selectAll('users')` scopes it to one table; bare `selectAll()` marks all tables in the query.

### JOINs

Joined tables appear in the result. Columns referenced in `ON` conditions are **not** recorded.

### Subqueries

Tables and columns from WHERE subqueries (e.g. `where('id', 'in', db.selectFrom(...))`) are merged into the top-level result. Subquery columns are not marked `selected` since they are not part of the outer query's output.

## Types

```typescript
import type {
  DissectedQuery,
  DissectedReadQuery,
  DissectedWriteQuery,
  DissectedTable,
  DissectedColumn,
} from '@repliql/kysely-dissect-query'
```

## License

MIT
