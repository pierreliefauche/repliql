import { type Primitive, stableStringify } from '@repliql/utils'
import type {
  AliasNode,
  AndNode,
  BinaryOperationNode,
  ColumnNode,
  CommonTableExpressionNode,
  IdentifierNode,
  JoinType,
  OperationNode,
  OperationNodeKind,
  OperationNodeSource,
  OperatorNode,
  OrderByItemNode,
  OrderByNode,
  OrNode,
  ParensNode,
  PrimitiveValueListNode,
  ReferenceNode,
  SelectQueryNode,
  TableNode,
  UnaryOperationNode,
  ValueListNode,
  ValueNode,
} from 'kysely'

import {
  type ChangeSubscription,
  type ScalarMatch,
  type ColumnMatch,
  MATCH_ALL,
  initChangeSubscription,
  matchAll,
  matchAllTable,
  matchTable,
  selectAll,
  selectAllTable,
  selectTable,
} from './ChangeSubscription'

interface JSONReferenceNode extends OperationNode {
  readonly kind: 'JSONReferenceNode'
  readonly reference: ReferenceNode
  readonly traversal: OperationNode
}

interface JSONOperatorChainNode extends OperationNode {
  readonly kind: 'JSONOperatorChainNode'
  readonly values: readonly ValueNode[]
}

interface JSONPathLegNode extends OperationNode {
  readonly kind: 'JSONPathLegNode'
  readonly type: 'Member' | 'ArrayLocation'
  readonly value: string | number
}

interface JSONPathNode extends OperationNode {
  readonly kind: 'JSONPathNode'
  readonly pathLegs: ReadonlyArray<JSONPathLegNode>
}

type RootQueryNodeKind =
  | 'SelectQueryNode'
  | 'InsertQueryNode'
  | 'UpdateQueryNode'
  | 'DeleteQueryNode'

type NonRootQueryNodeKind = Exclude<OperationNodeKind, RootQueryNodeKind>

// Loose views of ChangeSubscription.{selection,filter} that we can iterate
// generically regardless of the DB type parameter.
type LooseSelection = Record<string, true | Record<string, true | Record<string, true>> | undefined>
type LooseFilter = Record<string, typeof MATCH_ALL | Record<string, ColumnMatch>[] | undefined>

// Internal column-level predicate built during DNF construction. `fields`
// values are always 'all' or 'values' — deeper-than-1 JSON paths collapse
// to 'all' at construction time, so we never build nested 'fields'.
type ColumnPredicate =
  | { kind: 'all' }
  | { kind: 'values'; values: Primitive[] }
  | { kind: 'not-values'; values: Primitive[] }
  | { kind: 'fields'; fields: Map<string, ColumnPredicate> }

// Internal representation of a WHERE conjunct (a single AND-chain after DNF).
type Conjunct =
  // "Match any row of any of these tables". Empty list means no scope — emits a
  // single top-level MATCH_ALL (no queried tables known).
  | { kind: 'tables-all'; tables: string[] }
  // Narrow constraints, organised per-table plus unqualified-column constraints
  // that could belong to any queried table.
  | {
      kind: 'narrow'
      perTable: Map<string, Map<string, ColumnPredicate>>
      unqualified: Map<string, ColumnPredicate>
    }

function getTableName(node: TableNode): string {
  return node.table.identifier.name
}

function extractTableFromNode(node: OperationNode): { name: string; alias?: string } | undefined {
  switch (node.kind) {
    case 'TableNode':
      return { name: getTableName(node as TableNode) }
    case 'AliasNode': {
      const aliasNode = node as AliasNode
      if (aliasNode.node.kind === 'TableNode') {
        const realName = getTableName(aliasNode.node as TableNode)
        const alias =
          aliasNode.alias.kind === 'IdentifierNode'
            ? (aliasNode.alias as IdentifierNode).name
            : undefined
        return { name: realName, alias }
      }
      return undefined
    }
    default:
      return undefined
  }
}

function predicateToColumnMatch(p: ColumnPredicate): ColumnMatch {
  if (p.kind === 'all') return MATCH_ALL
  if (p.kind === 'values') return { $in: p.values }
  if (p.kind === 'not-values') return { $nin: p.values }
  const out: Record<string, ScalarMatch> = {}
  for (const [k, v] of p.fields) {
    if (v.kind === 'all') {
      out[k] = MATCH_ALL
    } else if (v.kind === 'values') {
      out[k] = { $in: v.values }
    } else if (v.kind === 'not-values') {
      out[k] = { $nin: v.values }
    } else {
      out[k] = MATCH_ALL
    }
  }
  return out
}

function parseJsonRef(node: JSONReferenceNode): {
  reference: ReferenceNode
  firstKey: string | undefined
  keyDepth: number
} {
  const traversal = node.traversal
  if (traversal.kind === 'JSONOperatorChainNode') {
    const chain = traversal as JSONOperatorChainNode
    const first = chain.values[0]?.value
    return {
      reference: node.reference,
      firstKey: typeof first === 'string' ? first : undefined,
      keyDepth: chain.values.length,
    }
  }
  if (traversal.kind === 'JSONPathNode') {
    const path = traversal as JSONPathNode
    const first = path.pathLegs[0]
    const firstKey =
      first && first.type === 'Member' && typeof first.value === 'string' ? first.value : undefined
    return {
      reference: node.reference,
      firstKey,
      keyDepth: path.pathLegs.length,
    }
  }
  return { reference: node.reference, firstKey: undefined, keyDepth: 0 }
}

class SelectChangeSubscriptionBuilder<DB> {
  // Accumulated output. Built incrementally via the ChangeSubscription helpers.
  private sub: ChangeSubscription<DB> = initChangeSubscription<DB>()
  // Tables that appear in FROM/JOIN — used for alias resolution and as the
  // widening scope when we can't attribute a column to a specific table.
  private queriedTables: Set<string> = new Set()
  // Inner-joined (mandatory-presence) tables. A change to these rows can
  // add/remove outer result rows even when no column is projected.
  private mandatoryJoined: Set<string> = new Set()
  // Real tables whose selection has been touched (directly or via absorption).
  // Drives the no-WHERE fallback matcher scope.
  private selectedTables: Set<string> = new Set()
  private aliasMap: Map<string, string> = new Map()
  // Names that look like tables in the outer query but actually refer to a
  // subquery-in-FROM or CTE. Their selection/filter are absorbed; outer
  // references to these names are skipped so they don't leak into the output.
  private subqueryAliases: Map<string, ChangeSubscription<DB>> = new Map()
  // Real tables whose scope has already been covered by an absorbed
  // subquery/CTE matcher — avoids emitting a duplicate wide matcher for them
  // from the outer no-WHERE branch.
  private absorbedTables: Set<string> = new Set()
  // Per-table dedupe keys for narrow filter entries, so identical disjuncts
  // don't create duplicate array entries.
  private emittedFilterKeys: Map<string, Set<string>> = new Map()

  build(node: SelectQueryNode): ChangeSubscription<DB> {
    this.collectTables(node)
    this.buildSelection(node)
    this.buildOrderBySelection(node)
    this.buildMatchers(node)
    return this.sub
  }

  // ---------- Selection accumulator helpers ----------

  private widenAllSelection(): void {
    this.sub = selectAll(this.sub)
  }

  private widenSelectedTable(tableName: string): void {
    this.selectedTables.add(tableName)
    this.sub = selectAllTable(this.sub, tableName as any)
  }

  private addSelectedColumn(tableName: string, columnName: string): void {
    this.selectedTables.add(tableName)
    this.sub = selectTable(this.sub, tableName as any, { [columnName]: true } as any)
  }

  // ---------- Filter accumulator helpers ----------

  private widenAllFilter(): void {
    this.sub = matchAll(this.sub)
  }

  private markTableFilterAll(tableName: string): void {
    this.sub = matchAllTable(this.sub, tableName as any)
  }

  private addTableFilter(tableName: string, filter: Record<string, ColumnMatch>): void {
    // Skip the push entirely when a narrower write would be subsumed by a
    // global/table MATCH_ALL that's already been set.
    if (this.sub.filter === MATCH_ALL) return
    if (this.sub.filter[tableName as keyof typeof this.sub.filter] === MATCH_ALL) return

    const key = stableStringify(filterDedupeKey(filter))
    let keys = this.emittedFilterKeys.get(tableName)
    if (!keys) {
      keys = new Set()
      this.emittedFilterKeys.set(tableName, keys)
    }
    if (keys.has(key)) return
    keys.add(key)
    this.sub = matchTable(this.sub, tableName as any, filter as any)
  }

  // ---------- Table collection / absorption ----------

  private collectTables(node: SelectQueryNode): void {
    // CTEs are absorbed first so that FROM references to their names can be
    // recognised as virtual tables rather than leaking into the outer output.
    if (node.with) {
      for (const cte of node.with.expressions) this.absorbCte(cte)
    }
    if (node.from) {
      for (const fromItem of node.from.froms) this.registerFromItem(fromItem)
    }
    if (node.joins) {
      for (const join of node.joins) {
        const info = extractTableFromNode(join.table)
        this.registerFromItem(join.table)
        if (info && this.isMandatoryJoin(join.joinType)) {
          this.mandatoryJoined.add(info.name)
        }
      }
    }
  }

  private isMandatoryJoin(kind: JoinType): boolean {
    return kind === 'InnerJoin' || kind === 'CrossJoin' || kind === 'LateralInnerJoin'
  }

  private registerFromItem(node: OperationNode): void {
    // Subquery-in-FROM: `selectFrom(eb => eb.selectFrom(...).as('u'))`
    if (node.kind === 'AliasNode') {
      const alias = node as AliasNode
      if (alias.node.kind === 'SelectQueryNode') {
        const aliasName =
          alias.alias.kind === 'IdentifierNode' ? (alias.alias as IdentifierNode).name : undefined
        const sub = new SelectChangeSubscriptionBuilder<DB>().build(alias.node as SelectQueryNode)
        if (aliasName) this.absorbSubquery(aliasName, sub)
        return
      }
    }
    const info = extractTableFromNode(node)
    if (!info) return
    // If the name is a CTE, expose its absorbed real tables for column
    // resolution without registering the CTE name itself.
    const absorbedCte = this.subqueryAliases.get(info.name)
    if (absorbedCte) {
      if (absorbedCte.selection !== true) {
        for (const t of Object.keys(absorbedCte.selection)) this.queriedTables.add(t)
      }
      if (info.alias) this.subqueryAliases.set(info.alias, absorbedCte)
      return
    }
    this.queriedTables.add(info.name)
    if (info.alias) this.aliasMap.set(info.alias, info.name)
  }

  private absorbCte(cte: CommonTableExpressionNode): void {
    const aliasName = getTableName(cte.name.table)
    if (cte.expression.kind !== 'SelectQueryNode') return
    const sub = new SelectChangeSubscriptionBuilder<DB>().build(cte.expression as SelectQueryNode)
    this.absorbSubquery(aliasName, sub)
  }

  private absorbSubquery(aliasName: string, sub: ChangeSubscription<DB>): void {
    this.subqueryAliases.set(aliasName, sub)

    // Inline selection.
    if (sub.selection === true) {
      this.widenAllSelection()
    } else {
      const selection = sub.selection as LooseSelection
      for (const [tName, tSel] of Object.entries(selection)) {
        if (tSel === undefined) continue
        this.absorbedTables.add(tName)
        if (tSel === true) {
          this.widenSelectedTable(tName)
        } else {
          for (const col of Object.keys(tSel)) this.addSelectedColumn(tName, col)
        }
      }
    }

    // Inline filter. A subquery's reads contribute to the outer filter — any
    // row change that would alter the subquery's result alters ours.
    if (sub.filter === MATCH_ALL) {
      this.widenAllFilter()
      return
    }
    const filter = sub.filter as LooseFilter
    for (const [tName, entry] of Object.entries(filter)) {
      if (entry === undefined) continue
      if (entry === MATCH_ALL) {
        this.markTableFilterAll(tName)
        continue
      }
      for (const e of entry) this.addTableFilter(tName, e)
    }
  }

  private resolveTableName(tableRef: string): string {
    return this.aliasMap.get(tableRef) ?? tableRef
  }

  // ---------- Selection ----------

  private buildSelection(node: SelectQueryNode): void {
    if (!node.selections) return
    for (const sel of node.selections) {
      if (this.sub.selection === true) break
      this.processSelection(sel.selection)
    }
  }

  private buildOrderBySelection(node: SelectQueryNode): void {
    if (!node.orderBy) return
    const orderByNode = node.orderBy as OrderByNode
    if (!orderByNode.items) return
    for (const item of orderByNode.items) {
      if (this.sub.selection === true) break
      this.processOrderByItem(item as OrderByItemNode)
    }
  }

  private processOrderByItem(item: OrderByItemNode): void {
    const node = item.orderBy
    if (!node) return

    switch (node.kind) {
      case 'ReferenceNode': {
        const ref = node as ReferenceNode
        if (ref.column.kind === 'SelectAllNode') {
          // orderBy on '*' is unusual but handle it
          this.widenAllQueriedSelection()
          return
        }
        if (ref.table) {
          const name = getTableName(ref.table as TableNode)
          if (this.subqueryAliases.has(name)) return
        }
        const resolved = this.resolveColumnRef(ref)
        if (!resolved) {
          this.widenAllSelection()
          return
        }
        this.addSelectedColumn(resolved.tableName, resolved.columnName)
        break
      }
      case 'JSONReferenceNode': {
        const parsed = parseJsonRef(node as JSONReferenceNode)
        const ref = parsed.reference
        if (ref.table) {
          const name = getTableName(ref.table as TableNode)
          if (this.subqueryAliases.has(name)) return
        }
        const resolved = this.resolveColumnRef(ref)
        if (!resolved) {
          this.widenAllSelection()
          return
        }
        if (parsed.firstKey === undefined) {
          this.addSelectedColumn(resolved.tableName, resolved.columnName)
          break
        }
        this.selectedTables.add(resolved.tableName)
        this.sub = selectTable(
          this.sub,
          resolved.tableName as any,
          {
            [resolved.columnName]: { [parsed.firstKey]: true },
          } as any,
        )
        break
      }
      default:
        // Raw SQL or complex expression — widen selection
        this.widenAllSelection()
        break
    }
  }

  private processSelection(node: OperationNode): void {
    switch (node.kind) {
      case 'ReferenceNode': {
        const ref = node as ReferenceNode
        if (ref.column.kind === 'SelectAllNode') {
          if (ref.table) {
            const name = getTableName(ref.table as TableNode)
            if (this.subqueryAliases.has(name)) break
            this.widenSelectedTable(this.resolveTableName(name))
          } else {
            this.widenAllQueriedSelection()
          }
        } else {
          if (ref.table) {
            const name = getTableName(ref.table as TableNode)
            // Reference into a subquery-in-FROM / CTE alias — its selection
            // is already absorbed; ignore the outer reference.
            if (this.subqueryAliases.has(name)) break
          }
          const resolved = this.resolveColumnRef(ref)
          if (!resolved) {
            this.widenAllSelection()
            return
          }
          this.addSelectedColumn(resolved.tableName, resolved.columnName)
        }
        break
      }
      case 'SelectAllNode': {
        this.widenAllQueriedSelection()
        break
      }
      case 'AliasNode': {
        this.processSelection((node as AliasNode).node)
        break
      }
      case 'JSONReferenceNode': {
        const parsed = parseJsonRef(node as JSONReferenceNode)
        const ref = parsed.reference
        if (ref.table) {
          const name = getTableName(ref.table as TableNode)
          if (this.subqueryAliases.has(name)) break
        }
        const resolved = this.resolveColumnRef(ref)
        if (!resolved) {
          this.widenAllSelection()
          return
        }
        if (parsed.firstKey === undefined) {
          this.addSelectedColumn(resolved.tableName, resolved.columnName)
          break
        }
        this.selectedTables.add(resolved.tableName)
        this.sub = selectTable(
          this.sub,
          resolved.tableName as any,
          {
            [resolved.columnName]: { [parsed.firstKey]: true },
          } as any,
        )
        break
      }
      default:
        this.widenAllSelection()
        break
    }
  }

  private widenAllQueriedSelection(): void {
    if (this.queriedTables.size === 0) {
      this.widenAllSelection()
      return
    }
    for (const name of this.queriedTables) this.widenSelectedTable(name)
  }

  private resolveColumnRef(
    ref: ReferenceNode,
  ): { tableName: string; columnName: string } | undefined {
    if (ref.column.kind === 'SelectAllNode') return undefined
    const columnName = (ref.column as ColumnNode).column.name
    if (ref.table) {
      const resolved = this.resolveTableName(getTableName(ref.table as TableNode))
      return { tableName: resolved, columnName }
    }
    if (this.queriedTables.size === 1) {
      const [name] = this.queriedTables
      return { tableName: name!, columnName }
    }
    return undefined
  }

  // ---------- Matchers ----------

  private buildMatchers(node: SelectQueryNode): void {
    let conjuncts: Conjunct[]
    if (node.where) {
      conjuncts = this.toDNF(node.where.where)
    } else {
      // No WHERE: any row of a selected table or a mandatory-join table can
      // affect the result set. Tables whose scope is already covered by an
      // absorbed subquery/CTE are excluded to avoid duplication.
      const scope = new Set<string>(this.selectedTables)
      for (const t of this.mandatoryJoined) scope.add(t)
      for (const t of this.absorbedTables) scope.delete(t)
      conjuncts = scope.size > 0 ? [{ kind: 'tables-all', tables: [...scope] }] : []
    }

    if (node.having) {
      // HAVING operates on groupings and isn't cleanly row-level. Push a
      // `tables-all` conjunct as an additional DNF branch (OR, not AND) so
      // the emitted matchers include a wide row-level match for every queried
      // table. Skip if an existing branch already covers the same width.
      const havingWidth = [...this.queriedTables]
      const alreadyWide = conjuncts.some(
        c => c.kind === 'tables-all' && this.covers(c.tables, havingWidth),
      )
      if (!alreadyWide) conjuncts.push({ kind: 'tables-all', tables: havingWidth })
    }

    for (const c of conjuncts) this.emitConjunct(c)
  }

  private covers(a: string[], b: string[]): boolean {
    const s = new Set(a)
    for (const t of b) if (!s.has(t)) return false
    return true
  }

  private emitConjunct(c: Conjunct): void {
    if (c.kind === 'tables-all') {
      if (c.tables.length === 0) {
        this.widenAllFilter()
        return
      }
      for (const t of c.tables) this.markTableFilterAll(t)
      return
    }
    const affected = new Set<string>(c.perTable.keys())
    if (c.unqualified.size > 0) {
      for (const t of this.queriedTables) affected.add(t)
    }
    if (affected.size === 0) {
      if (this.queriedTables.size === 0) {
        this.widenAllFilter()
      } else {
        for (const t of this.queriedTables) this.markTableFilterAll(t)
      }
      return
    }
    for (const t of affected) {
      const columns: Record<string, ColumnMatch> = {}
      const tableCols = c.perTable.get(t)
      if (tableCols) {
        for (const [col, v] of tableCols) columns[col] = predicateToColumnMatch(v)
      }
      for (const [col, v] of c.unqualified) {
        const existing = columns[col]
        columns[col] = existing
          ? predicateToColumnMatch(this.andMergeColumn(columnMatchToPredicate(existing), v))
          : predicateToColumnMatch(v)
      }
      this.addTableFilter(t, columns)
    }
    // Mandatory-joined tables not constrained by this conjunct still matter:
    // any row change in them can add/remove outer result rows through the join.
    for (const t of this.mandatoryJoined) {
      if (!affected.has(t)) this.markTableFilterAll(t)
    }
  }

  private toDNF(node: OperationNode): Conjunct[] {
    switch (node.kind) {
      case 'AndNode': {
        const n = node as AndNode
        return this.crossAnd(this.toDNF(n.left), this.toDNF(n.right))
      }
      case 'OrNode': {
        const n = node as OrNode
        return [...this.toDNF(n.left), ...this.toDNF(n.right)]
      }
      case 'ParensNode': {
        return this.toDNF((node as ParensNode).node)
      }
      case 'BinaryOperationNode': {
        return [this.processBinaryOp(node as BinaryOperationNode)]
      }
      case 'UnaryOperationNode': {
        // NOT X: keep the column references from X but widen their value
        // predicates (a negated equality no longer pins a specific value).
        const u = node as UnaryOperationNode
        return this.toDNF(u.operand).map(c => this.widenConjunctValues(c))
      }
      default:
        // Raw SQL / unrecognized predicate — could touch any queried table.
        return [{ kind: 'tables-all', tables: [...this.queriedTables] }]
    }
  }

  private widenConjunctValues(c: Conjunct): Conjunct {
    if (c.kind === 'tables-all') return c
    const perTable = new Map<string, Map<string, ColumnPredicate>>()
    for (const [t, cols] of c.perTable) {
      const m = new Map<string, ColumnPredicate>()
      for (const [k] of cols) m.set(k, { kind: 'all' })
      perTable.set(t, m)
    }
    const unqualified = new Map<string, ColumnPredicate>()
    for (const [k] of c.unqualified) unqualified.set(k, { kind: 'all' })
    return { kind: 'narrow', perTable, unqualified }
  }

  private crossAnd(a: Conjunct[], b: Conjunct[]): Conjunct[] {
    const out: Conjunct[] = []
    for (const x of a) for (const y of b) out.push(this.andMerge(x, y))
    return out
  }

  private andMerge(a: Conjunct, b: Conjunct): Conjunct {
    // AND identity: a "tables-all" scoped to the queried tables is basically
    // "any row" — it doesn't constrain, so the narrow side wins.
    const aIsIdentity = a.kind === 'tables-all' && this.covers(a.tables, [...this.queriedTables])
    const bIsIdentity = b.kind === 'tables-all' && this.covers(b.tables, [...this.queriedTables])
    if (aIsIdentity) return b
    if (bIsIdentity) return a
    if (a.kind === 'tables-all' || b.kind === 'tables-all') {
      const tables = new Set<string>()
      const addFrom = (c: Conjunct) => {
        if (c.kind === 'tables-all') for (const t of c.tables) tables.add(t)
        else {
          for (const t of c.perTable.keys()) tables.add(t)
          if (c.unqualified.size > 0) for (const t of this.queriedTables) tables.add(t)
        }
      }
      addFrom(a)
      addFrom(b)
      return { kind: 'tables-all', tables: [...tables] }
    }
    const perTable = new Map<string, Map<string, ColumnPredicate>>()
    for (const [t, cols] of a.perTable) perTable.set(t, new Map(cols))
    for (const [t, cols] of b.perTable) {
      const existing = perTable.get(t)
      if (!existing) {
        perTable.set(t, new Map(cols))
        continue
      }
      for (const [col, v] of cols) {
        const prev = existing.get(col)
        existing.set(col, prev ? this.andMergeColumn(prev, v) : v)
      }
    }
    const unqualified = new Map(a.unqualified)
    for (const [col, v] of b.unqualified) {
      const prev = unqualified.get(col)
      unqualified.set(col, prev ? this.andMergeColumn(prev, v) : v)
    }
    return { kind: 'narrow', perTable, unqualified }
  }

  private andMergeColumn(a: ColumnPredicate, b: ColumnPredicate): ColumnPredicate {
    if (a.kind === 'all') return b
    if (b.kind === 'all') return a
    if (a.kind === 'fields' && b.kind === 'fields') {
      const merged = new Map(a.fields)
      for (const [k, v] of b.fields) {
        const prev = merged.get(k)
        merged.set(k, prev ? this.andMergeColumn(prev, v) : v)
      }
      return { kind: 'fields', fields: merged }
    }
    if (a.kind === 'fields' || b.kind === 'fields') return { kind: 'all' }
    if (a.kind === 'values' && b.kind === 'values') {
      return { kind: 'values', values: [...a.values, ...b.values] }
    }
    if (a.kind === 'not-values' && b.kind === 'not-values') {
      return { kind: 'not-values', values: [...a.values, ...b.values] }
    }
    // values ∧ not-values → keep the whitelist (narrower)
    return a.kind === 'values' ? a : b
  }

  private processBinaryOp(node: BinaryOperationNode): Conjunct {
    // A subquery on the right side contributes its own read-matchers to the
    // outer query (changes to rows the subquery reads can change the outer
    // result). We still produce a conjunct for the left column below.
    if (node.rightOperand.kind === 'SelectQueryNode') {
      this.collectSubqueryMatchers(node.rightOperand as SelectQueryNode)
    }

    let ref: ReferenceNode
    let firstKey: string | undefined
    let keyDepth = 0
    if (node.leftOperand.kind === 'ReferenceNode') {
      ref = node.leftOperand as ReferenceNode
    } else if (node.leftOperand.kind === 'JSONReferenceNode') {
      const parsed = parseJsonRef(node.leftOperand as JSONReferenceNode)
      ref = parsed.reference
      firstKey = parsed.firstKey
      keyDepth = parsed.keyDepth
    } else {
      return { kind: 'tables-all', tables: [...this.queriedTables] }
    }

    if (node.operator.kind !== 'OperatorNode') {
      return { kind: 'tables-all', tables: [...this.queriedTables] }
    }
    const operator = (node.operator as OperatorNode).operator

    let scalar: ColumnPredicate
    if (operator === '=') {
      const v = this.extractSingleValue(node.rightOperand)
      scalar = v !== undefined ? { kind: 'values', values: [v as Primitive] } : { kind: 'all' }
    } else if (operator === 'in') {
      const vs = this.extractListValues(node.rightOperand)
      scalar = vs !== undefined ? { kind: 'values', values: vs as Primitive[] } : { kind: 'all' }
    } else if (operator === '!=' || operator === '<>') {
      const v = this.extractSingleValue(node.rightOperand)
      scalar = v !== undefined ? { kind: 'not-values', values: [v as Primitive] } : { kind: 'all' }
    } else if (operator === 'not in') {
      const vs = this.extractListValues(node.rightOperand)
      scalar =
        vs !== undefined ? { kind: 'not-values', values: vs as Primitive[] } : { kind: 'all' }
    } else {
      scalar = { kind: 'all' }
    }

    let column: ColumnPredicate
    if (firstKey === undefined) {
      column = scalar
    } else if (keyDepth >= 2) {
      column = { kind: 'fields', fields: new Map([[firstKey, { kind: 'all' }]]) }
    } else {
      column = { kind: 'fields', fields: new Map([[firstKey, scalar]]) }
    }

    if (ref.column.kind === 'SelectAllNode') {
      return { kind: 'tables-all', tables: [...this.queriedTables] }
    }
    const columnName = (ref.column as ColumnNode).column.name

    if (ref.table) {
      const rawName = getTableName(ref.table as TableNode)
      // WHERE on a subquery/CTE alias — conservatively widen (we don't try
      // to map the column back into the absorbed tables here).
      if (this.subqueryAliases.has(rawName)) {
        return { kind: 'tables-all', tables: [...this.queriedTables] }
      }
      const resolved = this.resolveTableName(rawName)
      const perTable = new Map<string, Map<string, ColumnPredicate>>()
      perTable.set(resolved, new Map([[columnName, column]]))
      return { kind: 'narrow', perTable, unqualified: new Map() }
    }
    if (this.queriedTables.size === 1) {
      const [name] = this.queriedTables
      const perTable = new Map<string, Map<string, ColumnPredicate>>()
      perTable.set(name!, new Map([[columnName, column]]))
      return { kind: 'narrow', perTable, unqualified: new Map() }
    }
    return {
      kind: 'narrow',
      perTable: new Map(),
      unqualified: new Map([[columnName, column]]),
    }
  }

  private collectSubqueryMatchers(subNode: SelectQueryNode): void {
    const sub = new SelectChangeSubscriptionBuilder<DB>().build(subNode)

    // Propagate the subquery's reads: its selection identifies tables/columns
    // whose changes can alter its result, which in turn alters ours.
    if (sub.selection === true) {
      this.widenAllFilter()
    } else {
      const selection = sub.selection as LooseSelection
      for (const [tName, tSel] of Object.entries(selection)) {
        if (tSel === undefined) continue
        if (tSel === true) {
          this.markTableFilterAll(tName)
          continue
        }
        const columns: Record<string, ColumnMatch> = {}
        for (const col of Object.keys(tSel)) columns[col] = MATCH_ALL
        this.addTableFilter(tName, columns)
      }
    }

    // Subquery's own WHERE-derived filter also propagates. Skip a table-wide
    // MATCH_ALL when we already added narrow entries for that table via the
    // selection pass above — the narrower constraint is more useful.
    if (sub.filter === MATCH_ALL) {
      this.widenAllFilter()
      return
    }
    const filter = sub.filter as LooseFilter
    for (const [tName, entry] of Object.entries(filter)) {
      if (entry === undefined) continue
      if (entry === MATCH_ALL) {
        if (this.hasNarrowFilterEntries(tName)) continue
        this.markTableFilterAll(tName)
        continue
      }
      for (const e of entry) this.addTableFilter(tName, e)
    }
  }

  private hasNarrowFilterEntries(tableName: string): boolean {
    if (this.sub.filter === MATCH_ALL) return false
    const entry = this.sub.filter[tableName as keyof typeof this.sub.filter]
    return Array.isArray(entry) && entry.length > 0
  }

  private extractSingleValue(node: OperationNode): unknown | undefined {
    if (node.kind === 'ValueNode') return (node as ValueNode).value
    return undefined
  }

  private extractListValues(node: OperationNode): unknown[] | undefined {
    switch (node.kind) {
      case 'PrimitiveValueListNode':
        return [...(node as PrimitiveValueListNode).values]
      case 'ValueListNode': {
        const items = (node as ValueListNode).values
        if (items.some(v => v.kind !== 'ValueNode')) return undefined
        return items.map(v => (v as ValueNode).value)
      }
      default:
        return undefined
    }
  }
}

function columnMatchToPredicate(v: ColumnMatch): ColumnPredicate {
  if (v === MATCH_ALL) return { kind: 'all' }
  if ('$in' in v) return { kind: 'values', values: (v as { $in: Primitive[] }).$in }
  if ('$nin' in v) return { kind: 'not-values', values: (v as { $nin: Primitive[] }).$nin }
  const fields = new Map<string, ColumnPredicate>()
  for (const [k, fv] of Object.entries(v)) {
    if (fv === MATCH_ALL) {
      fields.set(k, { kind: 'all' })
    } else if ('$in' in fv) {
      fields.set(k, { kind: 'values', values: fv.$in })
    } else {
      fields.set(k, { kind: 'not-values', values: (fv as { $nin: Primitive[] }).$nin })
    }
  }
  return { kind: 'fields', fields }
}

// Normalize MATCH_ALL to a sentinel string purely for dedupe-key purposes.
// Recurse into nested field objects so JSON-field filters dedupe correctly
// with stableStringify.
function filterDedupeKey(filter: Record<string, ColumnMatch>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(filter)) {
    out[k] = columnMatchDedupe(v)
  }
  return out
}

function columnMatchDedupe(v: ColumnMatch): unknown {
  if (v === MATCH_ALL) return '__MATCH_ALL__'
  if ('$in' in v || '$nin' in v) return v
  const out: Record<string, unknown> = {}
  for (const [k, fv] of Object.entries(v)) {
    out[k] = fv === MATCH_ALL ? '__MATCH_ALL__' : fv
  }
  return out
}

export function queryToChangeSubscription<DB, Q extends OperationNodeSource = OperationNodeSource>(
  query: Q,
): ChangeSubscription<DB> | undefined {
  const node = query.toOperationNode()

  switch (node.kind) {
    case 'SelectQueryNode':
      return new SelectChangeSubscriptionBuilder<DB>().build(node as SelectQueryNode)
    case 'InsertQueryNode':
    case 'UpdateQueryNode':
    case 'DeleteQueryNode':
      return undefined
    default: {
      node.kind satisfies NonRootQueryNodeKind
      return undefined
    }
  }
}
