import type {
  AliasNode,
  AndNode,
  BinaryOperationNode,
  ColumnNode,
  DeleteQueryNode,
  FromNode,
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

export type DissectedColumn = {
  selected: boolean
  eq?: unknown[]
  unknownOperator?: boolean
}

export type DissectedTable<TableSchema = any> = {
  unidentifiedColumn?: boolean
  columns: {
    [K in keyof TableSchema]?: DissectedColumn
  } & {
    [columnName: string]: DissectedColumn
  }
}

export type DissectedReadQuery<DB = any> = {
  operation: 'select'
  tables: {
    [K in keyof DB]?: DissectedTable<DB[K]>
  } & {
    [tableName: string]: DissectedTable
  }
  unidentifiedTable?: DissectedTable
}

export type DissectedWriteQuery<DB = any> = {
  operation: 'insert' | 'update' | 'delete' | 'unknown'
  table?: keyof DB & string
}

export type DissectedQuery<DB = any> = DissectedReadQuery<DB> | DissectedWriteQuery<DB>

// Node kinds we handle at the root level
type RootQueryNodeKind =
  | 'SelectQueryNode'
  | 'InsertQueryNode'
  | 'UpdateQueryNode'
  | 'DeleteQueryNode'

// Node kinds that are NOT root query nodes (for exhaustive checking)
type NonRootQueryNodeKind = Exclude<OperationNodeKind, RootQueryNodeKind>

// Node kinds we handle in selection walking
type SelectionChildKind = 'ReferenceNode' | 'SelectAllNode' | 'AliasNode'

// Node kinds we handle in WHERE expression walking
type WhereExpressionKind = 'AndNode' | 'OrNode' | 'ParensNode' | 'BinaryOperationNode'

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
            ? (aliasNode.alias as unknown as { name: string }).name
            : undefined
        return { name: realName, alias }
      }
      return undefined
    }
    default:
      return undefined
  }
}

function extractTableNameFromWriteTarget<DB = any>(
  node: OperationNode | undefined,
): (keyof DB & string) | undefined {
  if (!node) return undefined
  switch (node.kind) {
    case 'TableNode':
      return getTableName(node as TableNode) as keyof DB & string
    case 'AliasNode': {
      const aliasNode = node as AliasNode
      if (aliasNode.node.kind === 'TableNode') {
        return getTableName(aliasNode.node as TableNode) as keyof DB & string
      }
      return undefined
    }
    case 'FromNode': {
      const fromNode = node as FromNode
      const first = fromNode.froms[0]
      if (first) return extractTableNameFromWriteTarget<DB>(first)
      return undefined
    }
    default:
      return undefined
  }
}

class SelectQueryDissector<DB = any> {
  private tables: Map<string, DissectedTable> = new Map()
  private unidentifiedTable: DissectedTable | undefined
  // Maps alias → real table name
  private aliasMap: Map<string, string> = new Map()

  dissect(node: SelectQueryNode): DissectedReadQuery<DB> {
    this.collectTables(node)
    this.collectSelections(node)
    this.collectWhereColumns(node)
    this.collectHavingColumns(node)

    const result: DissectedReadQuery = {
      operation: 'select',
      tables: Object.fromEntries(this.tables),
    }
    if (this.unidentifiedTable) {
      result.unidentifiedTable = this.unidentifiedTable
    }
    return result
  }

  private collectTables(node: SelectQueryNode): void {
    if (node.from) {
      for (const fromItem of node.from.froms) {
        this.registerTable(fromItem)
      }
    }
    if (node.joins) {
      for (const join of node.joins) {
        this.registerTable(join.table)
      }
    }
  }

  private registerTable(node: OperationNode): void {
    const info = extractTableFromNode(node)
    if (!info) return
    if (!this.tables.has(info.name)) {
      this.tables.set(info.name, { columns: {} })
    }
    if (info.alias) {
      this.aliasMap.set(info.alias, info.name)
    }
  }

  private resolveTableName(tableRef: string): string {
    return this.aliasMap.get(tableRef) ?? tableRef
  }

  private getOrCreateTable(tableName: string): DissectedTable {
    let table = this.tables.get(tableName)
    if (!table) {
      table = { columns: {} }
      this.tables.set(tableName, table)
    }
    return table
  }

  private getOrCreateUnidentifiedTable(): DissectedTable {
    if (!this.unidentifiedTable) {
      this.unidentifiedTable = { columns: {} }
    }
    return this.unidentifiedTable
  }

  private resolveColumn(
    ref: ReferenceNode,
  ): { table: DissectedTable; columnName: string } | undefined {
    if (ref.column.kind === 'SelectAllNode') return undefined

    const columnName = (ref.column as ColumnNode).column.name

    if (ref.table) {
      const resolvedName = this.resolveTableName(getTableName(ref.table as TableNode))
      return { table: this.getOrCreateTable(resolvedName), columnName }
    }

    // Unqualified column: resolve to single table or unidentifiedTable
    if (this.tables.size === 1) {
      const [table] = this.tables.values()
      return { table: table!, columnName }
    }
    return { table: this.getOrCreateUnidentifiedTable(), columnName }
  }

  private ensureColumn(table: DissectedTable, columnName: string): DissectedColumn {
    let col = table.columns[columnName]
    if (!col) {
      col = { selected: false }
      table.columns[columnName] = col
    }
    return col
  }

  private collectSelections(node: SelectQueryNode): void {
    if (!node.selections) return

    for (const selectionNode of node.selections) {
      this.processSelection(selectionNode.selection)
    }
  }

  private processSelection(node: OperationNode): void {
    const kind = node.kind as SelectionChildKind
    switch (kind) {
      case 'ReferenceNode': {
        const ref = node as ReferenceNode
        if (ref.column.kind === 'SelectAllNode') {
          // table-qualified .* (e.g. users.*)
          if (ref.table) {
            const resolvedName = this.resolveTableName(getTableName(ref.table as TableNode))
            const table = this.getOrCreateTable(resolvedName)
            table.unidentifiedColumn = true
          } else {
            // bare selectAll — mark all tables
            for (const table of this.tables.values()) {
              table.unidentifiedColumn = true
            }
            if (this.tables.size === 0) {
              this.getOrCreateUnidentifiedTable().unidentifiedColumn = true
            }
          }
        } else {
          const resolved = this.resolveColumn(ref)
          if (resolved) {
            this.ensureColumn(resolved.table, resolved.columnName).selected = true
          }
        }
        break
      }
      case 'SelectAllNode': {
        // Bare selectAll() without table qualifier
        if (this.tables.size === 1) {
          const [table] = this.tables.values()
          table!.unidentifiedColumn = true
        } else if (this.tables.size > 1) {
          for (const table of this.tables.values()) {
            table.unidentifiedColumn = true
          }
        } else {
          this.getOrCreateUnidentifiedTable().unidentifiedColumn = true
        }
        break
      }
      case 'AliasNode': {
        const aliasNode = node as AliasNode
        this.processSelection(aliasNode.node)
        break
      }
      default: {
        // Raw SQL or other opaque expression — we can't know what columns it reads
        this.getOrCreateUnidentifiedTable().unidentifiedColumn = true
        break
      }
    }
  }

  private collectWhereColumns(node: SelectQueryNode): void {
    if (!node.where) return
    this.walkWhereExpression(node.where.where)
  }

  private collectHavingColumns(node: SelectQueryNode): void {
    if (!node.having) return
    this.walkWhereExpression(node.having.having)
  }

  private walkWhereExpression(node: OperationNode): void {
    const kind = node.kind as WhereExpressionKind | OperationNodeKind
    switch (kind) {
      case 'AndNode': {
        const andNode = node as AndNode
        this.walkWhereExpression(andNode.left)
        this.walkWhereExpression(andNode.right)
        break
      }
      case 'OrNode': {
        const orNode = node as OrNode
        this.walkWhereExpression(orNode.left)
        this.walkWhereExpression(orNode.right)
        break
      }
      case 'ParensNode': {
        const parensNode = node as ParensNode
        this.walkWhereExpression(parensNode.node)
        break
      }
      case 'BinaryOperationNode': {
        this.processBinaryOperation(node as BinaryOperationNode)
        break
      }
      default:
        // Raw SQL or other opaque expression — we can't know what it filters on
        this.getOrCreateUnidentifiedTable().unidentifiedColumn = true
        break
    }
  }

  private processBinaryOperation(node: BinaryOperationNode): void {
    // Check for subquery on the right side — merge its results
    if (node.rightOperand.kind === 'SelectQueryNode') {
      const subDissector = new SelectQueryDissector<DB>()
      const subResult = subDissector.dissect(node.rightOperand as SelectQueryNode)
      this.mergeReadResult(subResult)
    }

    // Process the left operand column reference
    if (node.leftOperand.kind !== 'ReferenceNode') {
      // Raw SQL or other opaque expression on the left — we can't know what column is being filtered
      this.getOrCreateUnidentifiedTable().unidentifiedColumn = true
      return
    }

    const ref = node.leftOperand as ReferenceNode
    const resolved = this.resolveColumn(ref)
    if (!resolved) return

    const col = this.ensureColumn(resolved.table, resolved.columnName)

    // Determine operator
    if (node.operator.kind !== 'OperatorNode') {
      col.unknownOperator = true
      return
    }

    const operator = (node.operator as OperatorNode).operator

    switch (operator) {
      case '=': {
        const value = this.extractSingleValue(node.rightOperand)
        if (value !== undefined) {
          if (!col.eq) col.eq = []
          col.eq.push(value)
        } else {
          col.unknownOperator = true
        }
        break
      }
      case 'in': {
        const values = this.extractListValues(node.rightOperand)
        if (values !== undefined) {
          if (!col.eq) col.eq = []
          col.eq.push(...values)
        } else {
          col.unknownOperator = true
        }
        break
      }
      default:
        col.unknownOperator = true
        break
    }
  }

  private extractSingleValue(node: OperationNode): unknown | undefined {
    if (node.kind === 'ValueNode') {
      return (node as ValueNode).value
    }
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

  private mergeReadResult(sub: DissectedReadQuery<DB>): void {
    for (const [tableName, subTable] of Object.entries(sub.tables)) {
      const target = this.getOrCreateTable(tableName)
      this.mergeTable(target, subTable)
    }
    if (sub.unidentifiedTable) {
      const target = this.getOrCreateUnidentifiedTable()
      this.mergeTable(target, sub.unidentifiedTable)
    }
  }

  private mergeTable(target: DissectedTable, source: DissectedTable): void {
    if (source.unidentifiedColumn) target.unidentifiedColumn = true
    for (const [colName, colData] of Object.entries(source.columns)) {
      const existing = this.ensureColumn(target, colName)
      // Don't carry over selected — subquery columns are read, not part of the parent's result
      if (colData.eq) {
        if (!existing.eq) existing.eq = []
        existing.eq.push(...colData.eq)
      }
      if (colData.unknownOperator) existing.unknownOperator = true
    }
  }
}

export function dissectQuery<DB = any, Q extends OperationNodeSource = OperationNodeSource>(
  query: Q,
): DissectedQuery<DB> {
  const node = query.toOperationNode()

  switch (node.kind) {
    case 'SelectQueryNode':
      return new SelectQueryDissector<DB>().dissect(node as SelectQueryNode)

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
