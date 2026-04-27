export type AnyTable<DB> = keyof DB & string

export type Row<DB, Table extends AnyTable<DB>> = Record<keyof DB[Table], unknown>

export type RowUpdate<DB = any, T extends AnyTable<DB> = AnyTable<DB>> = {
  [Table in AnyTable<DB>]: {
    table: Table
    rowId: number
    oldRow: Row<DB, Table> | null
    newRow: Row<DB, Table> | null
  }
}[T]
