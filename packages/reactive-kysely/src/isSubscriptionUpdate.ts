import { stableStringify } from '@repliql/utils'

import type {
  MaskMatcherColumn,
  MaskMatcherField,
  MaskMatcherTable,
  MaskSelectionTable,
  ReadQueryMask,
} from './queryToSubscriptionMask'

type Row = Record<string, unknown>

export type RowUpdate<DB = any> = {
  [Table in keyof DB & string]: {
    table: Table
    oldRow: Record<keyof DB[Table], unknown> | null
    newRow: Record<keyof DB[Table], unknown> | null
  }
}[keyof DB & string]

type CompiledMatcherField =
  | { key: string; type: 'all' }
  | { key: string; type: 'values'; set: Set<string> }

type CompiledMatcherColumn =
  | { col: string; type: 'all' }
  | { col: string; type: 'values'; set: Set<string> }
  | { col: string; type: 'fields'; fields: CompiledMatcherField[] }

type CompiledMatcher =
  | { type: 'all-columns' }
  | { type: 'narrow'; columns: CompiledMatcherColumn[] }

type CompiledColumnSelection =
  | { column: string; type: 'all' }
  | { column: string; type: 'fields'; fields: string[] }

type CompiledTableSelection =
  | { type: 'full-row' }
  | { type: 'columns'; columns: CompiledColumnSelection[] }

type CompiledSubscriptionMask = {
  matchAll: boolean
  byTable: Map<string, CompiledMatcher[]>
  selectAll: boolean
  selectionByTable: Map<string, CompiledTableSelection>
}

export function compileSubscriptionMask<DB>(mask: ReadQueryMask<DB>): CompiledSubscriptionMask {
  let matchAll = false
  const byTable = new Map<string, CompiledMatcher[]>()
  for (const m of mask.matchers) {
    if (m.type === 'all') {
      matchAll = true
      continue
    }
    const tableName = m.table as string
    const list = byTable.get(tableName) ?? []
    list.push(compileMatch(m.match))
    byTable.set(tableName, list)
  }

  let selectAll = false
  const selectionByTable = new Map<string, CompiledTableSelection>()
  if (mask.select.type === 'all') {
    selectAll = true
  } else {
    const tables = mask.select.tables as Record<string, MaskSelectionTable | undefined>
    for (const [name, sel] of Object.entries(tables)) {
      if (!sel) continue
      selectionByTable.set(name, compileSelectionTable(sel))
    }
  }
  return { matchAll, byTable, selectAll, selectionByTable }
}

function compileMatch(match: MaskMatcherTable): CompiledMatcher {
  if (match.type === 'all') return { type: 'all-columns' }
  const columns: CompiledMatcherColumn[] = []
  for (const [col, c] of Object.entries(match.columns)) {
    if (!c) continue
    columns.push(compileMatcherColumn(col, c as MaskMatcherColumn))
  }
  return { type: 'narrow', columns }
}

function compileMatcherColumn(col: string, c: MaskMatcherColumn): CompiledMatcherColumn {
  if (c.type === 'all') return { col, type: 'all' }
  if (c.type === 'values') {
    return { col, type: 'values', set: new Set(c.values.map(v => stableStringify(v))) }
  }
  const fields: CompiledMatcherField[] = []
  for (const [key, f] of Object.entries(c.fields)) {
    if (!f) continue
    fields.push(compileMatcherField(key, f as MaskMatcherField))
  }
  return { col, type: 'fields', fields }
}

function compileMatcherField(key: string, f: MaskMatcherField): CompiledMatcherField {
  if (f.type === 'all') return { key, type: 'all' }
  return { key, type: 'values', set: new Set(f.values.map(v => stableStringify(v))) }
}

function compileSelectionTable(sel: MaskSelectionTable): CompiledTableSelection {
  if (sel.type === 'all') return { type: 'full-row' }
  const columns: CompiledColumnSelection[] = []
  for (const [column, columnSelection] of Object.entries(sel.columns)) {
    if (!columnSelection) continue
    if (columnSelection.type === 'all') columns.push({ column, type: 'all' })
    else columns.push({ column, type: 'fields', fields: Object.keys(columnSelection.fields) })
  }
  return { type: 'columns', columns }
}

export function isSubscriptionUpdate<DB>(
  mask: CompiledSubscriptionMask,
  { table, oldRow, newRow }: RowUpdate<DB>,
): boolean {
  const oldMatches = oldRow != null && rowMatches(mask, table, oldRow)
  const newMatches = newRow != null && rowMatches(mask, table, newRow)

  if (!oldMatches && !newMatches) {
    // Row never matched, so discard
    return false
  }

  if (oldMatches !== newMatches) {
    // Row enters or leaves the set, so definitely match
    return true
  }

  return selectionChanged(mask, table, oldRow as Row, newRow as Row)
}

function rowMatches(
  { matchAll, byTable }: CompiledSubscriptionMask,
  table: string,
  row: Row,
): boolean {
  if (matchAll) {
    return true
  }

  const matchers = byTable.get(table)
  if (!matchers) {
    // Not interested in that table
    return false
  }

  return matchers.some(matcher => {
    if (matcher.type === 'all-columns') {
      return true
    }

    return matchAllColumns(matcher.columns, row)
  })
}

function matchAllColumns(columns: CompiledMatcherColumn[], row: Row): boolean {
  return columns.every(columnMatcher => {
    if (columnMatcher.type === 'all') {
      return true
    }

    const columnValue = row[columnMatcher.col]
    if (columnMatcher.type === 'values') {
      return columnMatcher.set.has(stableStringify(columnValue))
    }

    columnMatcher.type satisfies 'fields'

    if (columnValue == null || typeof columnValue !== 'object') {
      return false
    }

    return matchAllFields(columnMatcher.fields, columnValue as Row)
  })
}

function matchAllFields(fields: CompiledMatcherField[], obj: Row): boolean {
  return fields.every(field => {
    if (field.type === 'all') {
      return true
    }

    field.type satisfies 'values'

    return field.set.has(stableStringify(obj[field.key]))
  })
}

function selectionChanged(
  { selectAll, selectionByTable }: CompiledSubscriptionMask,
  table: string,
  oldRow: Row,
  newRow: Row,
): boolean {
  if (selectAll) {
    return areDifferent(oldRow, newRow)
  }

  const tableSelection = selectionByTable.get(table)
  if (!tableSelection) {
    return false
  }

  if (tableSelection.type === 'full-row') {
    return areDifferent(oldRow, newRow)
  }

  return tableSelection.columns.some(columnSelection => {
    const oldColumn = oldRow[columnSelection.column]
    const newColumn = newRow[columnSelection.column]

    if (columnSelection.type === 'all') {
      return areDifferent(oldColumn, newColumn)
    }

    columnSelection.type satisfies 'fields'

    const oldColumnObject = (oldColumn ?? {}) as Row
    const newColumnObject = (newColumn ?? {}) as Row

    return columnSelection.fields.some(field =>
      areDifferent(oldColumnObject[field], newColumnObject[field]),
    )
  })
}

function areDifferent(a: unknown, b: unknown): boolean {
  if (a === b) {
    return false
  }

  if (a == null && b == null) {
    // We consider undefined and null to be "equal"
    return false
  }

  if (isPrimitive(a) || isPrimitive(b)) {
    // One of the values is a primitive, so equality would
    // have been caught by strict equality above
    return true
  }

  // Comparing non primitives
  return stableStringify(a) !== stableStringify(b)
}

type Primitive = string | number | boolean | null | undefined

const primitiveTypes = new Set<string>([typeof 'string', typeof 42, typeof true, typeof undefined])

function isPrimitive(v: unknown): v is Primitive {
  return v == null || primitiveTypes.has(typeof v)
}
