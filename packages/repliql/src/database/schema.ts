import type { ColumnType, GeneratedAlways } from 'kysely'

type Generated<T> =
  T extends ColumnType<infer S, infer I, infer U>
    ? ColumnType<S, I | undefined, U>
    : ColumnType<T, T | undefined, T>

type Timestamp = ColumnType<Date, Date | string, Date | string>

export type DatabaseSchema = {
  entities: EntitiesTable
  queries: QueriesTable
}

export type EntitiesTable = {
  __typename: string
  id: string
  __ref: GeneratedAlways<string>
  data: ColumnType<Record<string, unknown>, string, string>
  createdAt: Generated<Timestamp>
  updatedAt: Timestamp
}

export type QueriesTable = {
  id: string
  data: unknown
  createdAt: Generated<Timestamp>
  updatedAt: Timestamp
}
