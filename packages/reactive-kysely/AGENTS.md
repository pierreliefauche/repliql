# Agents Guide: @repliql/reactive-kysely

## Package overview

This package provides **reactive queries** for [Kysely](https://github.com/kysely-org/kysely) — live-updating query results that automatically re-emit when underlying data changes.

The package has two main components:

1. **`queryToChangeSubscription`** — Converts a Kysely SELECT query into a `ChangeSubscription<DB>`, a static description of which row changes could affect the query's result. Works entirely on Kysely's in-memory AST (no database connection needed).

2. **`ReactiveKysely`** — A Kysely subclass that provides `liveQuery()`, returning a [Wonka](https://github.com/0no-co/wonka) `Source` that emits query results and re-emits when data changes. Uses SQLite triggers for change detection.

## Tech stack

- **Runtime/test/build**: Bun (`bun test`, `bun build`)
- **Language**: TypeScript (strict mode, ESNext target)
- **Peer dependency**: Kysely
- **Runtime deps**: `@repliql/utils` (hashing, stable stringify, SourceMap), `wonka` (reactive streams)
- **Dev deps**: `node-sqlite3-wasm` (for tests)
- **Formatting**: oxfmt (`bun run fmt`)
- **Linting**: oxlint (`bun run lint`)

## Key commands

```bash
bun test                                         # run tests
bun run build                                    # bundle + emit type declarations
bun run fmt                                      # format with oxfmt
bun run lint                                     # lint with oxlint
```

## Source files

| File                            | Purpose                                                             |
| ------------------------------- | ------------------------------------------------------------------- |
| `ReactiveKysely.ts`             | Main `ReactiveKysely` class with `liveQuery()` method               |
| `queryToChangeSubscription.ts`  | Converts Kysely query AST to `ChangeSubscription`                   |
| `ChangeSubscription.ts`         | `ChangeSubscription` type and builder functions                     |
| `isChangeSubscriptionUpdate.ts` | Fast runtime matching of row updates against compiled subscriptions |
| `types.ts`                      | Shared types (`AnyTable`, `Row`, `RowUpdate`)                       |
| `constants.ts`                  | Default configuration values                                        |

## Architecture

### ReactiveKysely

`ReactiveKysely<DB>` extends `Kysely<DB>` and adds reactive query capabilities:

- **`liveQuery(query, options?)`** — Returns a Wonka `Source<Result[]>` that:
  1. Emits the initial query result immediately on subscription
  2. Watches for INSERT/UPDATE/DELETE via SQLite triggers
  3. Re-executes and re-emits when matching changes occur
  4. Deduplicates emissions by result hash (no re-emit if data unchanged)
  5. Supports debouncing to batch rapid changes

Configuration requires a `createCallbackFunction` that registers SQLite callback functions (implementation depends on SQLite driver). Triggers are created lazily per-table on first watch.

### How Kysely represents queries internally

Kysely query builders implement `OperationNodeSource` and expose `toOperationNode()`, which returns an immutable tree of `OperationNode`s discriminated by a `kind: OperationNodeKind` string field.

Key node types for query analysis:

| Node                          | Kind / Fields                                            |
| ----------------------------- | -------------------------------------------------------- |
| SelectQueryNode               | `from`, `selections`, `joins`, `where`, `having`, `with` |
| TableNode                     | `table.identifier.name`                                  |
| ColumnNode                    | `column.name`                                            |
| ReferenceNode                 | `column` (ColumnNode or SelectAllNode), `table?`         |
| JSONReferenceNode             | `reference`, `traversal` (JSON path)                     |
| AliasNode                     | `node` (inner), `alias` (IdentifierNode)                 |
| BinaryOperationNode           | `leftOperand`, `operator`, `rightOperand`                |
| AndNode / OrNode / ParensNode | boolean structure                                        |
| UnaryOperationNode            | NOT                                                      |
| WhereNode / HavingNode        | wrap a filter expression                                 |
| ValueNode / ValueListNode     | literals                                                 |
| OperatorNode                  | `'='`, `'in'`, `'>'`, etc.                               |
| CommonTableExpressionNode     | CTE binding                                              |
| OrderByNode / OrderByItemNode | ORDER BY expressions                                     |

### How `queryToChangeSubscription` works

1. Call `query.toOperationNode()` and switch on `node.kind`.
2. For `SelectQueryNode`, delegate to `SelectChangeSubscriptionBuilder`:
   - **Collect tables** from FROM and JOIN, tracking alias→real-name map, mandatory-join set, and absorbed subquery/CTE aliases.
   - **Build `selection`** by walking `SelectionNode`s and `OrderByItemNode`s.
   - **Build `filter`** by normalising the WHERE expression to DNF (disjunctive normal form) and emitting one filter entry per disjunct. HAVING adds a wide disjunct.
   - **Dedupe** filter entries via `stableStringify`.
3. For write queries (INSERT/UPDATE/DELETE), return `undefined`.

### ChangeSubscription structure

```typescript
ChangeSubscription<DB> = {
  filter:
    | '*'                                    // Match any row from any table
    | {
        [Table]?:
          | '*'                              // Match any row from that table
          | TableColumnsFilter[]             // OR-array of column predicates
      }
  selection:
    | true                                   // Select all columns from all tables
    | {
        [Table]?:
          | true                             // Select all columns from that table
          | { [Column]?: true | { [field]: true } }  // Specific columns/JSON fields
      }
}
```

Column predicates within a filter entry:

- `'*'` — match any value
- `{ $in: Primitive[] }` — match specific values (from `=` or `IN` operators)
- `{ [field]: '*' | { $in: [...] } }` — JSON field matching

### Design decisions

These were explicitly discussed and agreed upon. Don't change them without checking with the user.

- **DNF normalisation**: WHERE is converted to OR-of-ANDs. Each AND-branch becomes a filter entry (or one entry per table it touches).
- **`=` and `IN` extract literal values** into `{ $in: [...] }`. All other operators widen to `'*'`.
- **NOT X**: preserves column references but widens their value predicates (a negated `=` no longer pins a value).
- **Mandatory joins** (inner, cross, lateral inner) contribute to the no-WHERE fallback scope. Left/right/full joins do NOT — missing rows just become NULL-padded.
- **No WHERE**: fallback emits a wide filter for every selected and mandatory-joined table (minus tables already covered by an absorbed subquery/CTE).
- **HAVING** adds a disjunct covering every queried table (row-level matching is conservative for grouped queries).
- **Subqueries in WHERE**: recursively built; their selection is turned into filters and their own filters are propagated.
- **Subqueries in FROM / CTEs** are **absorbed**: their selection/filter are inlined, and outer references to the alias are skipped so the virtual name doesn't leak into the subscription.
- **Aliases**: table aliases resolve to real names (`users as u`), column aliases are unwrapped (`id as uid`).
- **Unqualified columns** in a single-table query resolve to that table; in multi-table queries they're applied to every queried table at emit time.
- **ORDER BY columns** are tracked in selection (changes to order-by columns can affect result ordering).
- **JSON field access** (`column->>'field'`) tracks the specific field path; deeper paths (>1 level) widen to match any value in the top-level field.
- **Raw SQL / unrecognized predicate**: conservatively widens to match any row in every queried table.
- **Exhaustive kind checking** uses `node.kind satisfies NonRootQueryNodeKind` in the default branch of the root switch, so new Kysely root query kinds trip a compile error.

### Runtime matching

`isChangeSubscriptionUpdate` efficiently checks if a `RowUpdate` (from a trigger) matches a `ChangeSubscription`:

1. `compileChangeSubscription` pre-compiles the subscription into lookup-optimised structures (Sets for value matching).
2. For each row update, check if either the old or new row matches the filter.
3. If a matching row changed, check if any selected column/field actually changed.
4. Only return `true` if both filter matches AND selection changed.

This avoids unnecessary query re-execution when unrelated rows or columns change.

## Testing approach

Tests use a Kysely instance backed by `DummyDriver` (no real DB) for `queryToChangeSubscription`, and `node-sqlite3-wasm` for `ReactiveKysely` integration tests. Test cases are driven by tables of `{ it, query, result }` objects that assert on the full returned `ChangeSubscription` with `toEqual`.

## Potential future work

- **MERGE queries** — currently return `undefined`
