# Agents Guide: @repliql/reactive-kysely

## Package overview

This package turns a Kysely query into a **subscription mask** — a static description of which row changes could affect the query's result. The main export is `queryToSubscriptionMask`, which walks Kysely's internal AST (operation node tree) via `toOperationNode()`.

The mask has two parts:

- **`select`** — the shape of the projected result (tables and columns).
- **`matchers`** — predicates over rows such that if a matching row is inserted/updated/deleted, the query's result may have changed.

No database connection is needed — it works entirely on the in-memory query builder objects.

## Tech stack

- **Runtime/test/build**: Bun (`bun test`, `bun build`)
- **Language**: TypeScript (strict mode, ESNext target)
- **Peer dependency**: Kysely `^0.28.16`
- **Runtime dep**: `@repliql/utils` (for `stableStringify` — used to dedupe matchers)
- **Formatting**: oxfmt (`bun run fmt`)
- **Linting**: oxlint (`bun run lint`)

## Key commands

```bash
bun test                                         # run tests
bun run build                                    # bundle + emit type declarations
bun run fmt                                      # format with oxfmt
bun run lint                                     # lint with oxlint
```

## Architecture

### How Kysely represents queries internally

Kysely query builders implement `OperationNodeSource` and expose `toOperationNode()`, which returns an immutable tree of `OperationNode`s discriminated by a `kind: OperationNodeKind` string field.

Key node types for query analysis:

| Node                                                | Kind                                                     |
| --------------------------------------------------- | -------------------------------------------------------- |
| SelectQueryNode                                     | `from`, `selections`, `joins`, `where`, `having`, `with` |
| InsertQueryNode / UpdateQueryNode / DeleteQueryNode | write targets                                            |
| TableNode                                           | `table.identifier.name`                                  |
| ColumnNode                                          | `column.name`                                            |
| ReferenceNode                                       | `column` (ColumnNode or SelectAllNode), `table?`         |
| AliasNode                                           | `node` (inner), `alias` (IdentifierNode)                 |
| BinaryOperationNode                                 | `leftOperand`, `operator`, `rightOperand`                |
| AndNode / OrNode / ParensNode                       | boolean structure                                        |
| UnaryOperationNode                                  | NOT                                                      |
| WhereNode / HavingNode                              | wrap a filter expression                                 |
| ValueNode / PrimitiveValueListNode / ValueListNode  | literals                                                 |
| OperatorNode                                        | `'='`, `'in'`, `'>'`, etc.                               |
| CommonTableExpressionNode                           | CTE binding                                              |
| RawNode                                             | opaque raw SQL                                           |

### How `queryToSubscriptionMask` works

1. Call `query.toOperationNode()` and switch on `node.kind`.
2. For `SelectQueryNode`, delegate to `SelectMaskBuilder`:
   - **Collect tables** from FROM and JOIN, tracking an alias→real-name map, mandatory-join set, absorbed subquery/CTE aliases.
   - **Build `select`** by walking `SelectionNode`s.
   - **Build `matchers`** by normalising the WHERE expression to DNF (disjunctive normal form) and emitting one matcher per disjunct. HAVING adds a wide disjunct.
   - **Dedupe** matchers via `stableStringify`.
3. For write queries, extract the target table name.

### Design decisions

These were explicitly discussed and agreed upon. Don't change them without checking with the user.

- **DNF normalisation**: WHERE is converted to OR-of-ANDs. Each AND-branch becomes a matcher (or one matcher per table it touches).
- **`=` and `in` extract literal values** into `{ type: 'values', values: [...] }`. All other operators widen to `{ type: 'all' }`.
- **NOT X**: preserves column references but widens their value predicates (a negated `=` no longer pins a value).
- **Mandatory joins** (inner, cross, lateral inner) contribute to the no-WHERE fallback scope. Left/right/full joins do NOT — missing rows just become NULL-padded.
- **No WHERE**: fallback emits a wide matcher for every selected and mandatory-joined table (minus tables already covered by an absorbed subquery/CTE).
- **HAVING** adds a disjunct covering every queried table (row-level matching is conservative for grouped queries).
- **Subqueries in WHERE**: recursively built; their selection is turned into matchers and their own matchers are propagated.
- **Subqueries in FROM / CTEs** are **absorbed**: their selection/matchers are inlined, and outer references to the alias are skipped so the virtual name doesn't leak into the mask.
- **Aliases**: table aliases resolve to real names (`users as u`), column aliases are unwrapped (`id as uid`).
- **Unqualified columns** in a single-table query resolve to that table; in multi-table queries they're stored as `unqualified` and applied to every queried table at emit time.
- **Raw SQL / unrecognized predicate**: conservatively widens to `tables-all` over every queried table.
- **Exhaustive kind checking** uses `node.kind satisfies NonRootQueryNodeKind` in the default branch of the root switch, so new Kysely root query kinds trip a compile error.

### Output types

```typescript
QueryMask<DB> = ReadQueryMask<DB> | WriteQueryMask<DB>

ReadQueryMask<DB> = {
  operation: 'select'
  select: MaskSelection<DB>
  matchers: MaskMatcher<DB>[]
}

WriteQueryMask<DB> = {
  operation: 'insert' | 'update' | 'delete' | 'unknown'
  table?: keyof DB & string
}

MaskSelection =
  | { type: 'all' }
  | { type: 'narrow', tables: { [T]: MaskSelectionTable } }

MaskSelectionTable =
  | { type: 'all' }
  | { type: 'narrow', columns: { [C]: MaskSelectionColumn } }

MaskMatcher =
  | { type: 'all' }
  | { type: 'narrow', table: T, match: MaskMatcherTable }

MaskMatcherColumn =
  | { type: 'all' }
  | { type: 'values', values: unknown[] }
  | { type: 'fields', fields: { [F]: MaskMatcherField } }
```

The internal `Conjunct` type (`'tables-all'` | `'narrow'` with `perTable` + `unqualified` maps) is how WHERE disjuncts are represented during DNF construction, before being emitted as matchers.

## Testing approach

Tests use a Kysely instance backed by `DummyDriver` (no real DB). Cases are driven by a table of `{ it, query, result }` objects that each assert on the **full** returned `QueryMask` with `toEqual`, catching unexpected extra fields.

## Files

- `src/queryToSubscriptionMask.ts` — types and implementation
- `src/queryToSubscriptionMask.test.ts` — test suite
- `src/index.ts` — re-exports

## Potential future work

- **MERGE queries** — currently fall through to `unknown`
