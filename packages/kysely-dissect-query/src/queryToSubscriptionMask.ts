import type {
  AliasNode,
  AndNode,
  BinaryOperationNode,
  ColumnNode,
  DeleteQueryNode,
  InsertQueryNode,
  OperationNode,
  OperationNodeKind,
  OperationNodeSource,
  OperatorNode,
  OrNode,
  ParensNode,
  PrimitiveValueListNode,
  ReferenceNode,
  SelectQueryNode,
  TableNode,
  UpdateQueryNode,
  ValueListNode,
  ValueNode,
} from 'kysely'

import {
  extractTableFromNode,
  extractTableNameFromWriteTarget,
  getTableName,
} from './dissect-query'

type MaskSelectionColumn =
  | { type: 'all' }
  | {
      type: 'narrow'
      fields: {
        [F in string]: true
      }
    }

type MaskSelectionTable<TableSchema = any> =
  | { type: 'all' }
  | {
      type: 'narrow'
      columns: {
        [C in keyof TableSchema]?: MaskSelectionColumn
      }
    }

type MaskSelection<DB = any> =
  | { type: 'all' }
  | {
      type: 'narrow'
      tables: {
        [T in keyof DB]?: MaskSelectionTable<DB[T]>
      }
    }

type MaskMatcherField = { type: 'all' } | { type: 'narrow'; values: unknown[] }

type MaskMatcherColumn =
  | { type: 'all' }
  | { type: 'values'; values: unknown[] }
  | {
      type: 'fields'
      fields: {
        [F in string]: MaskMatcherField
      }
    }

type MaskMatcherTable<TableSchema> =
  | { type: 'all' }
  | {
      type: 'narrow'
      columns: {
        [C in keyof TableSchema]?: MaskMatcherColumn
      }
    }

export type MaskMatcher<DB = any> =
  | { type: 'all' }
  | {
      [T in keyof DB]: {
        type: 'narrow'
        table: T
        match: MaskMatcherTable<DB[T]>
      }
    }[keyof DB]

export type ReadQueryMask<DB = any> = {
  operation: 'select'
  select: MaskSelection<DB>
  matchers: MaskMatcher<DB>[]
}

export type WriteQueryMask<DB = any> = {
  operation: 'insert' | 'update' | 'delete' | 'unknown'
  table?: keyof DB & string
}

export type QueryMask<DB = any> = ReadQueryMask<DB> | WriteQueryMask<DB>

type RootQueryNodeKind =
  | 'SelectQueryNode'
  | 'InsertQueryNode'
  | 'UpdateQueryNode'
  | 'DeleteQueryNode'

type NonRootQueryNodeKind = Exclude<OperationNodeKind, RootQueryNodeKind>

// Internal representation of a WHERE conjunct (a single AND-chain after DNF).
type Conjunct =
  // "Match any row of any of these tables". Empty list means no scope — emits a
  // single top-level {type:'all'} matcher (no queried tables known).
  | { kind: 'tables-all'; tables: string[] }
  // Narrow constraints, organised per-table plus unqualified-column constraints
  // that could belong to any queried table.
  | {
      kind: 'narrow'
      perTable: Map<string, Map<string, MaskMatcherColumn>>
      unqualified: Map<string, MaskMatcherColumn>
    }

class SelectMaskBuilder<DB = any> {
  // Tables that appear in FROM/JOIN — used for alias resolution and as the
  // widening scope when we can't attribute a column to a specific table.
  private queriedTables: Set<string> = new Set()
  // Columns actually projected by SELECT, per table. Drives the output `select`.
  private selectedTables: Map<string, MaskSelectionTable> = new Map()
  private aliasMap: Map<string, string> = new Map()
  private selectAll = false
  // Matchers derived from WHERE subqueries — they describe tables/columns the
  // subquery reads (its result changes iff one of those rows changes).
  private subqueryMatchers: MaskMatcher[] = []

  build(node: SelectQueryNode): ReadQueryMask<DB> {
    this.collectTables(node)
    const select = this.buildSelection(node)
    const matchers = this.buildMatchers(node)
    return {
      operation: 'select',
      select: select as MaskSelection<DB>,
      matchers: matchers as MaskMatcher<DB>[],
    }
  }

  private collectTables(node: SelectQueryNode): void {
    if (node.from) {
      for (const fromItem of node.from.froms) this.registerTable(fromItem)
    }
    if (node.joins) {
      for (const join of node.joins) this.registerTable(join.table)
    }
  }

  private registerTable(node: OperationNode): void {
    const info = extractTableFromNode(node)
    if (!info) return
    this.queriedTables.add(info.name)
    if (info.alias) this.aliasMap.set(info.alias, info.name)
  }

  private resolveTableName(tableRef: string): string {
    return this.aliasMap.get(tableRef) ?? tableRef
  }

  // ---------- Selection ----------

  private buildSelection(node: SelectQueryNode): MaskSelection {
    if (node.selections) {
      for (const sel of node.selections) {
        if (this.selectAll) break
        this.processSelection(sel.selection)
      }
    }
    if (this.selectAll) return { type: 'all' }
    const tables: Record<string, MaskSelectionTable> = {}
    for (const [name, table] of this.selectedTables) tables[name] = table
    return { type: 'narrow', tables }
  }

  private widenSelectedTable(tableName: string): void {
    this.selectedTables.set(tableName, { type: 'all' })
  }

  private addSelectedColumn(tableName: string, columnName: string): void {
    const existing = this.selectedTables.get(tableName)
    if (!existing) {
      this.selectedTables.set(tableName, {
        type: 'narrow',
        columns: { [columnName]: { type: 'all' } },
      })
      return
    }
    if (existing.type === 'all') return
    existing.columns[columnName] = { type: 'all' }
  }

  private processSelection(node: OperationNode): void {
    switch (node.kind) {
      case 'ReferenceNode': {
        const ref = node as ReferenceNode
        if (ref.column.kind === 'SelectAllNode') {
          if (ref.table) {
            const resolved = this.resolveTableName(getTableName(ref.table as TableNode))
            this.widenSelectedTable(resolved)
          } else {
            this.widenAllQueriedSelection()
          }
        } else {
          const resolved = this.resolveColumnRef(ref)
          if (!resolved) {
            this.selectAll = true
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
      default:
        this.selectAll = true
        break
    }
  }

  private widenAllQueriedSelection(): void {
    if (this.queriedTables.size === 0) {
      this.selectAll = true
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

  private buildMatchers(node: SelectQueryNode): MaskMatcher[] {
    let conjuncts: Conjunct[]
    if (node.where) {
      conjuncts = this.toDNF(node.where.where)
    } else {
      // No WHERE: rows from any selected table are in scope.
      conjuncts = [{ kind: 'tables-all', tables: [...this.selectedTables.keys()] }]
    }

    if (node.having) {
      // HAVING operates on groupings and isn't cleanly row-level; widen to
      // all queried tables (unless we already have an equally-wide conjunct).
      const havingWidth = [...this.queriedTables]
      const alreadyWide = conjuncts.some(
        c => c.kind === 'tables-all' && this.covers(c.tables, havingWidth),
      )
      if (!alreadyWide) conjuncts.push({ kind: 'tables-all', tables: havingWidth })
    }

    const matchers: MaskMatcher[] = []
    for (const c of conjuncts) this.emitMatchers(c, matchers)
    matchers.push(...this.subqueryMatchers)
    return this.dedupMatchers(matchers)
  }

  private covers(a: string[], b: string[]): boolean {
    const s = new Set(a)
    for (const t of b) if (!s.has(t)) return false
    return true
  }

  private emitMatchers(c: Conjunct, out: MaskMatcher[]): void {
    if (c.kind === 'tables-all') {
      if (c.tables.length === 0) {
        out.push({ type: 'all' })
        return
      }
      for (const t of c.tables) {
        out.push({ type: 'narrow', table: t as any, match: { type: 'all' } })
      }
      return
    }
    const affected = new Set<string>(c.perTable.keys())
    if (c.unqualified.size > 0) {
      for (const t of this.queriedTables) affected.add(t)
    }
    if (affected.size === 0) {
      // Nothing to match on — fall back to queried scope.
      if (this.queriedTables.size === 0) {
        out.push({ type: 'all' })
      } else {
        for (const t of this.queriedTables) {
          out.push({ type: 'narrow', table: t as any, match: { type: 'all' } })
        }
      }
      return
    }
    for (const t of affected) {
      const columns: Record<string, MaskMatcherColumn> = {}
      const tableCols = c.perTable.get(t)
      if (tableCols) for (const [col, v] of tableCols) columns[col] = v
      for (const [col, v] of c.unqualified) {
        const existing = columns[col]
        columns[col] = existing ? this.andMergeColumn(existing, v) : v
      }
      out.push({
        type: 'narrow',
        table: t as any,
        match: { type: 'narrow', columns },
      })
    }
  }

  private dedupMatchers(matchers: MaskMatcher[]): MaskMatcher[] {
    const seen = new Set<string>()
    const out: MaskMatcher[] = []
    for (const m of matchers) {
      const key = JSON.stringify(m)
      if (seen.has(key)) continue
      seen.add(key)
      out.push(m)
    }
    return out
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
      default:
        // Raw SQL / unrecognized predicate — could touch any queried table.
        return [{ kind: 'tables-all', tables: [...this.queriedTables] }]
    }
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
      // Neither is identity but one is tables-all — widen to union.
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
    const perTable = new Map<string, Map<string, MaskMatcherColumn>>()
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

  private andMergeColumn(a: MaskMatcherColumn, b: MaskMatcherColumn): MaskMatcherColumn {
    if (a.type === 'all') return b
    if (b.type === 'all') return a
    if (a.type === 'values' && b.type === 'values') {
      return { type: 'values', values: [...a.values, ...b.values] }
    }
    return { type: 'all' }
  }

  private processBinaryOp(node: BinaryOperationNode): Conjunct {
    // A subquery on the right side contributes its own read-matchers to the
    // outer query (changes to rows the subquery reads can change the outer
    // result). We still produce a conjunct for the left column below.
    if (node.rightOperand.kind === 'SelectQueryNode') {
      this.collectSubqueryMatchers(node.rightOperand as SelectQueryNode)
    }

    if (node.leftOperand.kind !== 'ReferenceNode') {
      return { kind: 'tables-all', tables: [...this.queriedTables] }
    }
    const ref = node.leftOperand as ReferenceNode

    if (node.operator.kind !== 'OperatorNode') {
      return { kind: 'tables-all', tables: [...this.queriedTables] }
    }
    const operator = (node.operator as OperatorNode).operator

    let column: MaskMatcherColumn
    if (operator === '=') {
      const v = this.extractSingleValue(node.rightOperand)
      column = v !== undefined ? { type: 'values', values: [v] } : { type: 'all' }
    } else if (operator === 'in') {
      const vs = this.extractListValues(node.rightOperand)
      column = vs !== undefined ? { type: 'values', values: vs } : { type: 'all' }
    } else {
      column = { type: 'all' }
    }

    // Resolve the column. If qualified or single-queried-table → specific table.
    // If unqualified in multi-table → record as unqualified (will apply to all
    // queried tables at emit time).
    if (ref.column.kind === 'SelectAllNode') {
      return { kind: 'tables-all', tables: [...this.queriedTables] }
    }
    const columnName = (ref.column as ColumnNode).column.name

    if (ref.table) {
      const resolved = this.resolveTableName(getTableName(ref.table as TableNode))
      const perTable = new Map<string, Map<string, MaskMatcherColumn>>()
      perTable.set(resolved, new Map([[columnName, column]]))
      return { kind: 'narrow', perTable, unqualified: new Map() }
    }
    if (this.queriedTables.size === 1) {
      const [name] = this.queriedTables
      const perTable = new Map<string, Map<string, MaskMatcherColumn>>()
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
    const sub = new SelectMaskBuilder<DB>().build(subNode)
    // Convert the subquery's selection into per-table matchers: changes to
    // columns the subquery reads can change its result, which can change ours.
    if (sub.select.type === 'all') {
      this.subqueryMatchers.push({ type: 'all' })
      return
    }
    for (const [tableName, table] of Object.entries(sub.select.tables)) {
      if (!table) continue
      if ((table as MaskSelectionTable).type === 'all') {
        this.subqueryMatchers.push({
          type: 'narrow',
          table: tableName as any,
          match: { type: 'all' },
        })
        continue
      }
      const columns: Record<string, MaskMatcherColumn> = {}
      const narrowTable = table as Extract<MaskSelectionTable, { type: 'narrow' }>
      for (const col of Object.keys(narrowTable.columns)) columns[col] = { type: 'all' }
      this.subqueryMatchers.push({
        type: 'narrow',
        table: tableName as any,
        match: { type: 'narrow', columns },
      })
    }
    // Subquery's own WHERE-derived matchers also propagate.
    for (const m of sub.matchers) {
      if (m.type === 'all') {
        this.subqueryMatchers.push(m)
        continue
      }
      // Skip wide "match any row of table T" matchers when we already have a
      // narrower selection-based matcher for T.
      const existingNarrow = this.subqueryMatchers.some(
        em => em.type === 'narrow' && em.table === m.table && em.match.type === 'narrow',
      )
      if (m.match.type === 'all' && existingNarrow) continue
      this.subqueryMatchers.push(m as any)
    }
  }

  private extractSingleValue(node: OperationNode): unknown | undefined {
    if (node.kind === 'ValueNode') return (node as ValueNode).value
    return undefined
  }

  private extractListValues(node: OperationNode): unknown[] | undefined {
    switch (node.kind) {
      case 'PrimitiveValueListNode':
        return [...(node as PrimitiveValueListNode).values]
      case 'ValueListNode':
        return (node as ValueListNode).values
          .filter((v): v is ValueNode => v.kind === 'ValueNode')
          .map(v => v.value)
      default:
        return undefined
    }
  }
}

export function queryToSubscriptionMask<
  DB = any,
  Q extends OperationNodeSource = OperationNodeSource,
>(query: Q): QueryMask<DB> {
  const node = query.toOperationNode()

  switch (node.kind) {
    case 'SelectQueryNode':
      return new SelectMaskBuilder<DB>().build(node as SelectQueryNode)

    case 'InsertQueryNode': {
      const insertNode = node as InsertQueryNode
      return {
        operation: 'insert',
        table: extractTableNameFromWriteTarget<DB>(insertNode.into),
      }
    }

    case 'UpdateQueryNode': {
      const updateNode = node as UpdateQueryNode
      return {
        operation: 'update',
        table: extractTableNameFromWriteTarget<DB>(updateNode.table),
      }
    }

    case 'DeleteQueryNode': {
      const deleteNode = node as DeleteQueryNode
      return {
        operation: 'delete',
        table: extractTableNameFromWriteTarget<DB>(deleteNode.from),
      }
    }

    default: {
      node.kind satisfies NonRootQueryNodeKind
      return { operation: 'unknown' }
    }
  }
}
