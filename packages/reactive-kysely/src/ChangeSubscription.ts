import { type Primitive } from '@repliql/utils'

import { AnyTable } from './types'

export const MATCH_ALL = '*'
type MatchAll = typeof MATCH_ALL

type TableColumnsSelection<DB, Table extends AnyTable<DB>> = {
  [Column in keyof DB[Table]]?:
    | true // select all values from that column
    | {
        // select specific fields for columns that are JSON
        [Field: string]: true
      }
}

export type ScalarMatch =
  | MatchAll // match any value
  | { $in: Primitive[] } // match specific values with equality (only for primitives)
  | { $nin: Primitive[] } // match specific values with INequality (only for primitives)

export type FieldMatch = ScalarMatch | { [Field: string]: FieldMatch }

export type ColumnMatch = ScalarMatch | { [Field: string]: FieldMatch }

type TableColumnsFilter<DB, Table extends AnyTable<DB>> = {
  [Column in keyof DB[Table]]?: ColumnMatch
}

export type ChangeSubscription<DB> = {
  filter:
    | MatchAll // Match any row from any table
    | {
        [Table in AnyTable<DB>]?:
          | MatchAll // Match any row from that table
          | TableColumnsFilter<DB, Table>[]
      }
  selection:
    | true // select all columns from all tables
    | {
        [Table in AnyTable<DB>]?:
          | true // select all columns from that table
          | TableColumnsSelection<DB, Table>
      }
}

export function initChangeSubscription<DB>(): ChangeSubscription<DB> {
  return { filter: {}, selection: {} }
}

export function selectTable<DB, Table extends AnyTable<DB>>(
  sub: ChangeSubscription<DB>,
  table: Table,
  selection: TableColumnsSelection<DB, Table>,
): ChangeSubscription<DB> {
  if (sub.selection === true) {
    return sub
  }

  const current = sub.selection?.[table]
  if (current === true) {
    return sub
  }

  const merged: Record<string, unknown> = { ...selection }
  if (typeof current === 'object') {
    for (const [column, existing] of Object.entries(current)) {
      const incoming = merged[column]
      if (existing === true || incoming === true) {
        merged[column] = true
      } else if (typeof existing === 'object' && typeof incoming === 'object') {
        merged[column] = { ...existing, ...incoming }
      } else {
        merged[column] = existing ?? incoming
      }
    }
  }

  return { ...sub, selection: { ...sub.selection, [table]: merged } }
}

export function selectAllTable<DB, Table extends AnyTable<DB>>(
  sub: ChangeSubscription<DB>,
  table: Table,
): ChangeSubscription<DB> {
  if (sub.selection === true) {
    return sub
  }

  return { ...sub, selection: { ...sub.selection, [table]: true } }
}

export function selectAll<DB>(sub: ChangeSubscription<DB>): ChangeSubscription<DB> {
  return { ...sub, selection: true }
}

export function matchTable<DB, Table extends AnyTable<DB>>(
  sub: ChangeSubscription<DB>,
  table: Table,
  filter: TableColumnsFilter<DB, Table>,
): ChangeSubscription<DB> {
  if (sub.filter === MATCH_ALL) {
    return sub
  }

  const current = sub.filter[table]
  if (current === MATCH_ALL) {
    return sub
  }

  const filters = Array.isArray(current) ? [...current, filter] : [filter]
  return {
    ...sub,
    filter: { ...sub.filter, [table]: filters },
  }
}

export function matchAllTable<DB, Table extends AnyTable<DB>>(
  sub: ChangeSubscription<DB>,
  table: Table,
): ChangeSubscription<DB> {
  if (sub.filter === MATCH_ALL) {
    return sub
  }

  return { ...sub, filter: { ...sub.filter, [table]: MATCH_ALL } }
}

export function matchAll<DB>(sub: ChangeSubscription<DB>): ChangeSubscription<DB> {
  return { ...sub, filter: MATCH_ALL }
}

export function changeSubscriptionTables<DB>(
  sub: ChangeSubscription<DB>,
): MatchAll | AnyTable<DB>[] {
  if (sub.filter === MATCH_ALL || sub.selection === true) {
    return MATCH_ALL
  }

  return [
    ...new Set([
      ...(Object.keys(sub.filter) as AnyTable<DB>[]),
      ...(Object.keys(sub.selection) as AnyTable<DB>[]),
    ]),
  ]
}
