import { stableStringify, areEqual } from '@repliql/utils'

import { type ChangeSubscription, MATCH_ALL } from './ChangeSubscription'
import type { RowUpdate } from './types'

type AnyRow = Record<string, unknown>

type CompiledFilterField =
  | { key: string; type: 'all' }
  | { key: string; type: 'values'; set: Set<string> }
  | { key: string; type: 'not-values'; set: Set<string> }
  | { key: string; type: 'fields'; fields: CompiledFilterField[] }

type CompiledFilterColumn =
  | { col: string; type: 'all' }
  | { col: string; type: 'values'; set: Set<string> }
  | { col: string; type: 'not-values'; set: Set<string> }
  | { col: string; type: 'fields'; fields: CompiledFilterField[] }

type CompiledFilterEntry = { columns: CompiledFilterColumn[] }

type CompiledTableFilter = { type: 'all' } | { type: 'entries'; entries: CompiledFilterEntry[] }

type CompiledColumnSelection =
  | { column: string; type: 'all' }
  | { column: string; type: 'fields'; fields: string[] }

type CompiledTableSelection =
  | { type: 'full-row' }
  | { type: 'columns'; columns: CompiledColumnSelection[] }

export type CompiledChangeSubscription = {
  matchAll: boolean
  filterByTable: Map<string, CompiledTableFilter>
  selectAll: boolean
  selectionByTable: Map<string, CompiledTableSelection>
}

export function compileChangeSubscription<DB>(
  sub: ChangeSubscription<DB>,
): CompiledChangeSubscription {
  let matchAll = false
  const filterByTable = new Map<string, CompiledTableFilter>()
  if (sub.filter === MATCH_ALL) {
    matchAll = true
  } else {
    const filter = sub.filter as Record<string, unknown>
    for (const [table, entry] of Object.entries(filter)) {
      if (entry === undefined) {
        continue
      }
      if (entry === MATCH_ALL) {
        filterByTable.set(table, { type: 'all' })
        continue
      }
      const entries = (entry as Record<string, unknown>[]).map(compileFilterEntry)
      filterByTable.set(table, { type: 'entries', entries })
    }
  }

  let selectAll = false
  const selectionByTable = new Map<string, CompiledTableSelection>()
  if (sub.selection === true) {
    selectAll = true
  } else {
    const selection = sub.selection as Record<string, unknown>
    for (const [table, sel] of Object.entries(selection)) {
      if (sel === undefined) {
        continue
      }
      if (sel === true) {
        selectionByTable.set(table, { type: 'full-row' })
        continue
      }
      selectionByTable.set(table, compileTableSelection(sel as Record<string, unknown>))
    }
  }

  return { matchAll, filterByTable, selectAll, selectionByTable }
}

function compileFilterEntry(entry: Record<string, unknown>): CompiledFilterEntry {
  const columns: CompiledFilterColumn[] = []
  for (const [col, value] of Object.entries(entry)) {
    if (value === undefined) {
      continue
    }
    columns.push(compileFilterColumn(col, value))
  }
  return { columns }
}

function compileFilterColumn(col: string, value: unknown): CompiledFilterColumn {
  if (value === MATCH_ALL) {
    return { col, type: 'all' }
  }
  if (isInMatch(value)) {
    return { col, type: 'values', set: new Set(value.$in.map(v => stableStringify(v))) }
  }
  if (isNinMatch(value)) {
    return { col, type: 'not-values', set: new Set(value.$nin.map(v => stableStringify(v))) }
  }
  const fields: CompiledFilterField[] = []
  for (const [key, f] of Object.entries(value as Record<string, unknown>)) {
    if (f === undefined) {
      continue
    }
    fields.push(compileFilterField(key, f))
  }
  return { col, type: 'fields', fields }
}

function compileFilterField(key: string, f: unknown): CompiledFilterField {
  if (f === MATCH_ALL) {
    return { key, type: 'all' }
  }
  if (isInMatch(f)) {
    return { key, type: 'values', set: new Set(f.$in.map(v => stableStringify(v))) }
  }
  if (isNinMatch(f)) {
    return { key, type: 'not-values', set: new Set(f.$nin.map(v => stableStringify(v))) }
  }
  const nested: CompiledFilterField[] = []
  for (const [subKey, sub] of Object.entries(f as Record<string, unknown>)) {
    if (sub === undefined) {
      continue
    }
    nested.push(compileFilterField(subKey, sub))
  }
  return { key, type: 'fields', fields: nested }
}

function isInMatch(v: unknown): v is { $in: unknown[] } {
  return typeof v === 'object' && v !== null && '$in' in v && Array.isArray((v as any).$in)
}

function isNinMatch(v: unknown): v is { $nin: unknown[] } {
  return typeof v === 'object' && v !== null && '$nin' in v && Array.isArray((v as any).$nin)
}

function compileTableSelection(sel: Record<string, unknown>): CompiledTableSelection {
  const columns: CompiledColumnSelection[] = []
  for (const [column, columnSel] of Object.entries(sel)) {
    if (columnSel === undefined) {
      continue
    }
    if (columnSel === true) {
      columns.push({ column, type: 'all' })
      continue
    }
    columns.push({
      column,
      type: 'fields',
      fields: Object.keys(columnSel as Record<string, unknown>),
    })
  }
  return { type: 'columns', columns }
}

export function isChangeSubscriptionUpdate<DB>(
  compiled: CompiledChangeSubscription,
  { table, oldRow, newRow }: RowUpdate<DB>,
): boolean {
  const oldMatches = oldRow != null && rowMatches(compiled, table, oldRow as AnyRow)
  const newMatches = newRow != null && rowMatches(compiled, table, newRow as AnyRow)

  if (!oldMatches && !newMatches) {
    return false
  }

  if (oldMatches !== newMatches) {
    return true
  }

  return selectionChanged(compiled, table, oldRow as AnyRow, newRow as AnyRow)
}

function rowMatches(
  { matchAll, filterByTable }: CompiledChangeSubscription,
  table: string,
  row: AnyRow,
): boolean {
  if (matchAll) {
    return true
  }

  const tableFilter = filterByTable.get(table)
  if (!tableFilter) {
    return false
  }

  if (tableFilter.type === 'all') {
    return true
  }

  return tableFilter.entries.some(entry => matchAllColumns(entry.columns, row))
}

function matchAllColumns(columns: CompiledFilterColumn[], row: AnyRow): boolean {
  return columns.every(columnMatcher => {
    if (columnMatcher.type === 'all') {
      return true
    }

    const columnValue = row[columnMatcher.col]
    if (columnMatcher.type === 'values') {
      return columnMatcher.set.has(stableStringify(columnValue))
    }
    if (columnMatcher.type === 'not-values') {
      return !columnMatcher.set.has(stableStringify(columnValue))
    }

    columnMatcher.type satisfies 'fields'

    if (columnValue == null || typeof columnValue !== 'object') {
      return false
    }

    return matchAllFields(columnMatcher.fields, columnValue as AnyRow)
  })
}

function matchAllFields(fields: CompiledFilterField[], obj: AnyRow): boolean {
  return fields.every(field => {
    if (field.type === 'all') {
      return true
    }
    const value = obj[field.key]
    if (field.type === 'values') {
      return field.set.has(stableStringify(value))
    }
    if (field.type === 'not-values') {
      return !field.set.has(stableStringify(value))
    }

    field.type satisfies 'fields'

    if (value == null || typeof value !== 'object') {
      return false
    }
    return matchAllFields(field.fields, value as AnyRow)
  })
}

function selectionChanged(
  { selectAll, selectionByTable }: CompiledChangeSubscription,
  table: string,
  oldRow: AnyRow,
  newRow: AnyRow,
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

    const oldColumnObject = (oldColumn ?? {}) as AnyRow
    const newColumnObject = (newColumn ?? {}) as AnyRow

    return columnSelection.fields.some(field =>
      areDifferent(oldColumnObject[field], newColumnObject[field]),
    )
  })
}

function areDifferent(a: unknown, b: unknown): boolean {
  return !areEqual(a, b)
}
