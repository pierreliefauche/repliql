import { EntityRef } from '@repliql/utils'
import type { ColumnType, GeneratedAlways } from 'kysely'

type Timestamp = ColumnType<Date, Date | string, Date | string>

export type DatabaseSchema = {
  entities: EntitiesTable
  queries: QueriesTable
}

export type EntitiesTable = {
  __typename: string
  id: string
  __ref: ColumnType<EntityRef, EntityRef, never>
  data: ColumnType<Record<string, unknown>, string, string>
  updatedByOperationKey: number | null
  createdAt: GeneratedAlways<Timestamp>
  updatedAt: Timestamp
}

export type QueriesTable = {
  id: string
  data: unknown
  updatedByOperationKey: number | null
  createdAt: GeneratedAlways<Timestamp>
  updatedAt: Timestamp
}
