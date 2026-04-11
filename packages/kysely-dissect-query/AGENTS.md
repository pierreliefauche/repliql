# Agents Guide: @repliql/kysely-dissect-query

## Package overview

This package provides static analysis utilities for [Kysely](https://github.com/kysely-org/kysely) queries. The main export is `dissectQuery`, which walks Kysely's internal AST (operation node tree) and returns a structured description of what tables and columns a query touches.

No database connection is needed -- it works entirely on the in-memory query builder objects via `toOperationNode()`.

## Tech stack

- **Runtime/test/build**: Bun (`bun test`, `bun build`)
- **Language**: TypeScript (strict mode, ESNext target)
- **Peer dependency**: Kysely `^0.28.16`
- **Formatting**: oxfmt (`bun run fmt`)
- **Linting**: oxlint (`bun run lint`)
- **No runtime dependencies** -- only Kysely as a peer dep

## Key commands

```bash
bun test ./src/dissect-query.test.ts   # run tests
bun run build                          # bundle + emit type declarations
bun run fmt                            # format with oxfmt
bun run lint                           # lint with oxlint
```

## Architecture

### How Kysely represents queries internally

Kysely query builders (SelectQueryBuilder, InsertQueryBuilder, etc.) implement `OperationNodeSource`, which provides `toOperationNode()`. This returns an immutable tree of `OperationNode` objects, each discriminated by a `kind: OperationNodeKind` string field.

Key node types for query analysis:

| Node                   | Kind string                | Key fields                                                   |
| ---------------------- | -------------------------- | ------------------------------------------------------------ |
| SelectQueryNode        | `'SelectQueryNode'`        | `from`, `selections`, `joins`, `where`, `having`             |
| InsertQueryNode        | `'InsertQueryNode'`        | `into`                                                       |
| UpdateQueryNode        | `'UpdateQueryNode'`        | `table`, `where`                                             |
| DeleteQueryNode        | `'DeleteQueryNode'`        | `from`, `where`                                              |
| TableNode              | `'TableNode'`              | `table.identifier.name`                                      |
| ColumnNode             | `'ColumnNode'`             | `column.name`                                                |
| ReferenceNode          | `'ReferenceNode'`          | `column` (ColumnNode or SelectAllNode), `table?` (TableNode) |
| AliasNode              | `'AliasNode'`              | `node` (inner), `alias` (IdentifierNode)                     |
| BinaryOperationNode    | `'BinaryOperationNode'`    | `leftOperand`, `operator`, `rightOperand`                    |
| AndNode / OrNode       | `'AndNode'` / `'OrNode'`   | `left`, `right`                                              |
| WhereNode              | `'WhereNode'`              | `where` (the filter expression)                              |
| HavingNode             | `'HavingNode'`             | `having` (the filter expression)                             |
| ValueNode              | `'ValueNode'`              | `value` (the literal)                                        |
| PrimitiveValueListNode | `'PrimitiveValueListNode'` | `values` (array of primitives, used for `IN` lists)          |
| OperatorNode           | `'OperatorNode'`           | `operator` (`'='`, `'in'`, `'>'`, etc.)                      |
| RawNode                | `'RawNode'`                | `sqlFragments`, `parameters` (opaque raw SQL)                |

All node types are exported from `kysely` and can be imported directly.

### How `dissectQuery` works

1. Calls `query.toOperationNode()` to get the root node
2. Switches on `node.kind` to determine the query type
3. For SELECT queries, uses `SelectQueryDissector` class which:
   - **Collects tables** from `FromNode.froms` and `JoinNode.table`, building an alias-to-real-name map
   - **Collects selections** by walking `SelectionNode` children (ReferenceNode, SelectAllNode, AliasNode)
   - **Collects WHERE columns** by recursively walking the WHERE expression tree (AndNode, OrNode, ParensNode, BinaryOperationNode)
   - **Collects HAVING columns** by walking the HAVING expression tree using the same logic as WHERE
4. For write queries (INSERT/UPDATE/DELETE), extracts the target table name

### Design decisions

These were explicitly discussed and agreed upon. Don't change them without checking with the user.

- **Table aliases** are resolved to real names. `selectFrom('users as u').select('u.id')` reports under `users`, not `u`.
- **Column aliases** are unwrapped. `select('users.id as uid')` reports column `id`, not `uid`.
- **JOIN ON columns are skipped**. Only the joined table is registered; columns in the ON condition are not recorded.
- **`=` and `in` are equality operators** that populate the `eq` array. All other operators set `unknownOperator: true`.
- **When `=` or `in` can't extract concrete values** (e.g. subquery or raw SQL on the right side), `unknownOperator` is set.
- **Subqueries in WHERE** are recursively dissected and merged into the top-level result. Subquery columns are NOT marked `selected` since they don't appear in the parent's result set.
- **Raw SQL** (RawNode) in any position signals `unidentifiedTable.unidentifiedColumn = true` since we can't statically analyze what it touches.
- **Unqualified columns** in single-table queries resolve to that table. In multi-table queries they go to `unidentifiedTable`.
- **`selectAll()`** sets `unidentifiedColumn: true`. Scoped `selectAll('users')` only marks that table.
- **Exhaustive type checking** uses `satisfies NonRootQueryNodeKind` on the default branch of the root switch. If Kysely adds new root query node kinds, this will be a compile error.

### Output types

```typescript
DissectedQuery = DissectedReadQuery | DissectedWriteQuery

DissectedReadQuery = {
  operation: 'select'
  tables: { [tableName: string]: DissectedTable }
  unidentifiedTable?: DissectedTable     // columns/expressions we can't resolve to a table
}

DissectedWriteQuery = {
  operation: 'insert' | 'update' | 'delete' | 'unknown'
  table?: string                         // target table name
}

DissectedTable = {
  unidentifiedColumn?: boolean           // true when selectAll() or raw SQL is used
  columns: { [columnName: string]: DissectedColumn }
}

DissectedColumn = {
  selected: boolean                      // true if in the SELECT clause
  eq?: unknown[]                         // concrete values from = or IN filters
  unknownOperator?: boolean              // true when filtered by unsupported operator
}
```

## Testing approach

Tests use a Kysely instance with `DummyDriver` (no real DB needed). Each test builds a query, calls `dissectQuery`, and asserts on the **full return object** with `toEqual` -- not individual fields. This makes tests easy to review and catches unexpected extra fields.

```typescript
const db = new Kysely<DB>({
  dialect: {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: db => new PostgresIntrospector(db),
    createQueryCompiler: () => new PostgresQueryCompiler(),
  },
})
```

## Files

- `src/dissect-query.ts` -- types and implementation
- `src/dissect-query.test.ts` -- test suite (36 tests)
- `src/index.ts` -- re-exports

## Potential future work

These are areas NOT yet handled that could be added:

- **UPDATE/DELETE WHERE dissection** -- these queries have WHERE clauses too, but currently only the target table is extracted
- **RETURNING clause** -- makes write queries return data, currently not tracked
- **CTEs (WITH clause)** -- define temporary named result sets that read from additional tables
- **MERGE queries** -- Kysely supports MergeQueryNode, currently falls through to `unknown`
- **Nested subqueries in FROM** -- subquery as a table source (not just in WHERE)
