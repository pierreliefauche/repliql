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
  // "fields" if for when columns contain JSON
  // but that's not something you can know,
  // so always use "type: all" to mean "any and all values for that column"
  | {
      type: 'all'
    }
  | {
      type: 'narrow'
      fields: {
        [F in string]: true
      }
    }

type MaskSelectionTable<TableSchema = any> =
  | {
      // When we cannot determine which exact columns are being selected
      type: 'all'
    }
  | {
      type: 'narrow'
      columns: {
        [C in keyof TableSchema]?: MaskSelectionColumn
      }
    }

type MaskSelection<DB = any> =
  | {
      // When we cannot determine which exact tables are being selected
      type: 'all'
    }
  | {
      type: 'narrow'
      tables: {
        [T in keyof DB]?: MaskSelectionTable<DB[T]>
      }
    }

// Fields are to match in json, which you cannot do,
// so don't use it
type MaskMatcherField =
  | {
      type: 'all'
    }
  | {
      type: 'narrow'
      values: unknown[]
    }

type MaskMatcherColumn =
  // To match any value of that column (use that in doubt)
  | {
      type: 'all'
    }
  // to match with **equality**, for strings, numbers, booleans
  | {
      type: 'values'
      values: unknown[]
    }
  // Fields are to match in json, which you cannot do,
  // so don't use it
  | {
      type: 'fields'
      fields: {
        [F in string]: MaskMatcherField
      }
    }

type MaskMatcherTable<TableSchema> =
  | {
      type: 'all'
    }
  | {
      type: 'narrow'
      columns: {
        [C in keyof TableSchema]?: MaskMatcherColumn
      }
    }

export type MaskMatcher<DB = any, T extends keyof DB = keyof DB> =
  // To match everything on all tables
  // useful when we cannot infer what to match against from AST
  | {
      type: 'all'
    }
  // REVIEW: I changed this type to allow only 1 table per matcher
  | {
      type: 'narrow'
      table: T
      match: MaskMatcherTable<DB[T]>
    }

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

class SelectMaskBuilder<DB = any> {
  private tables: Map<string, MaskSelectionTable> = new Map()
  private aliasMap: Map<string, string> = new Map()
  private selectAll = false

  build(node: SelectQueryNode): ReadQueryMask<DB> {
    this.collectTables(node)
    const select = this.buildSelection(node)
    const matchers = this.buildMatchers(node)
    return { operation: 'select', select: select as MaskSelection<DB>, matchers }
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
    if (!this.tables.has(info.name)) {
      this.tables.set(info.name, { type: 'narrow', columns: {} })
    }
    if (info.alias) this.aliasMap.set(info.alias, info.name)
  }

  private resolveTableName(tableRef: string): string {
    return this.aliasMap.get(tableRef) ?? tableRef
  }

  private widenTable(tableName: string): void {
    this.tables.set(tableName, { type: 'all' })
  }

  private addColumn(tableName: string, columnName: string): void {
    const existing = this.tables.get(tableName)
    if (!existing) {
      this.tables.set(tableName, {
        type: 'narrow',
        columns: { [columnName]: { type: 'all' } },
      })
      return
    }
    if (existing.type === 'all') return
    existing.columns[columnName] = { type: 'all' }
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
    for (const [name, table] of this.tables) tables[name] = table
    return { type: 'narrow', tables }
  }

  private processSelection(node: OperationNode): void {
    switch (node.kind) {
      case 'ReferenceNode': {
        const ref = node as ReferenceNode
        if (ref.column.kind === 'SelectAllNode') {
          if (ref.table) {
            const resolved = this.resolveTableName(getTableName(ref.table as TableNode))
            this.widenTable(resolved)
          } else {
            this.widenAllTablesOrAll()
          }
        } else {
          const resolved = this.resolveColumnRef(ref)
          if (!resolved) {
            this.selectAll = true
            return
          }
          this.addColumn(resolved.tableName, resolved.columnName)
        }
        break
      }
      case 'SelectAllNode': {
        this.widenAllTablesOrAll()
        break
      }
      case 'AliasNode': {
        this.processSelection((node as AliasNode).node)
        break
      }
      default:
        // Raw SQL or opaque expression — we can't know which columns/tables
        this.selectAll = true
        break
    }
  }

  private widenAllTablesOrAll(): void {
    if (this.tables.size === 0) {
      this.selectAll = true
      return
    }
    for (const name of this.tables.keys()) this.widenTable(name)
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
    if (this.tables.size === 1) {
      const [name] = this.tables.keys()
      return { tableName: name!, columnName }
    }
    return undefined
  }

  // ---------- Matchers ----------

  private buildMatchers(node: SelectQueryNode): MaskMatcher[] {
    let matchers: MaskMatcher[] = node.where
      ? this.toDNF(node.where.where)
      : [this.allQueriedTables()]
    if (node.having) {
      // HAVING operates on groupings and is hard to reason about — widen safely
      // to all tables the query touches.
      const widest = this.allQueriedTables()
      const alreadyWidest = matchers.some(m => this.isAtLeastAsWide(m, widest))
      if (!alreadyWidest) matchers = [...matchers, widest]
    }
    return matchers
  }

  // Matcher covering any row of any table this query references.
  // Used as the safe-but-scoped fallback instead of `{type:'all'}`.
  private allQueriedTables(): MaskMatcher {
    if (this.tables.size === 0) return { type: 'all' }
    const tables: Record<string, MaskMatcherTable<any>> = {}
    for (const name of this.tables.keys()) tables[name] = { type: 'all' }
    return { type: 'narrow', tables }
  }

  private isAtLeastAsWide(a: MaskMatcher, b: MaskMatcher): boolean {
    if (a.type === 'all') return true
    if (b.type === 'all') return false
    for (const [name, bt] of Object.entries(b.tables)) {
      const at = a.tables[name]
      if (!at) return false
      if (at.type === 'all') continue
      if (bt!.type === 'all') return false
    }
    return true
  }

  private toDNF(node: OperationNode): MaskMatcher[] {
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
        // Raw SQL / unrecognized predicate — could reference any column of any queried table.
        return [this.allQueriedTables()]
    }
  }

  private crossAnd(a: MaskMatcher[], b: MaskMatcher[]): MaskMatcher[] {
    const out: MaskMatcher[] = []
    for (const x of a) for (const y of b) out.push(this.andMerge(x, y))
    return out
  }

  private andMerge(a: MaskMatcher, b: MaskMatcher): MaskMatcher {
    if (a.type === 'all') return b
    if (b.type === 'all') return a
    const tables: Record<string, MaskMatcherTable<any>> = {}
    for (const [name, t] of Object.entries(a.tables)) tables[name] = t!
    for (const [name, t] of Object.entries(b.tables)) {
      const existing = tables[name]
      tables[name] = existing ? this.andMergeTable(existing, t!) : t!
    }
    return { type: 'narrow', tables }
  }

  private andMergeTable(a: MaskMatcherTable<any>, b: MaskMatcherTable<any>): MaskMatcherTable<any> {
    if (a.type === 'all') return b
    if (b.type === 'all') return a
    const columns: Record<string, MaskMatcherColumn> = {}
    for (const [name, c] of Object.entries(a.columns)) columns[name] = c!
    for (const [name, c] of Object.entries(b.columns)) {
      const existing = columns[name]
      columns[name] = existing ? this.andMergeColumn(existing, c!) : c!
    }
    return { type: 'narrow', columns }
  }

  private andMergeColumn(a: MaskMatcherColumn, b: MaskMatcherColumn): MaskMatcherColumn {
    if (a.type === 'all') return b
    if (b.type === 'all') return a
    if (a.type === 'values' && b.type === 'values') {
      return { type: 'values', values: [...a.values, ...b.values] }
    }
    // fields-involved merges shouldn't occur from AST; widen safely.
    return { type: 'all' }
  }

  private processBinaryOp(node: BinaryOperationNode): MaskMatcher {
    if (node.leftOperand.kind !== 'ReferenceNode') return this.allQueriedTables()
    const ref = node.leftOperand as ReferenceNode
    const resolved = this.resolveColumnRef(ref)
    if (!resolved) return this.allQueriedTables()

    if (node.operator.kind !== 'OperatorNode') return this.allQueriedTables()
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

    return {
      type: 'narrow',
      tables: {
        [resolved.tableName]: {
          type: 'narrow',
          columns: { [resolved.columnName]: column },
        },
      },
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
