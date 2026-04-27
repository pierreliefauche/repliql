import { Entity, EntityRef } from '@repliql/utils'
import type { ColumnType, GeneratedAlways } from 'kysely'

type ReadOnly<T> = ColumnType<T, T, never>

type Timestamp = ColumnType<Date, Date | string, Date | string>

export const RESOLVED_MUTATION_STATUSES = ['applied', 'failed', 'canceled'] as const

export const ACTIVE_MUTATION_STATUSES = ['draft', 'pending', 'inflight'] as const

export type ResolvedMutationStatus = (typeof RESOLVED_MUTATION_STATUSES)[number]
export type ActiveMutationStatus = (typeof ACTIVE_MUTATION_STATUSES)[number]
export type MutationStatus = ResolvedMutationStatus | ActiveMutationStatus

export type DatabaseSchema = {
  entities: EntitiesTable
  queries: QueriesTable
  mutations: MutationsTable
  mutationPatches: MutationPatchesTable
}

export type EntitiesTable = {
  __typename: string
  id: ReadOnly<string>
  __ref: EntityRef
  data: ColumnType<Entity, string, string>
  base: null | ColumnType<Entity, string, string>
  updatedByOperationKey: number | null
  $createdAt: GeneratedAlways<Timestamp>
  $updatedAt: Timestamp
}

export type QueriesTable = {
  id: ReadOnly<string>
  data: unknown
  updatedByOperationKey: number | null
  $createdAt: GeneratedAlways<Timestamp>
  $updatedAt: Timestamp
}

export type MutationsTable = {
  id: ReadOnly<string>
  name: ReadOnly<string | null>
  query: ReadOnly<string>
  params: ColumnType<Record<string, unknown>, string, never>
  status: MutationStatus
  $createdAt: GeneratedAlways<Timestamp>
  $updatedAt: Timestamp
}

export type MutationPatchesTable = {
  mutationId: MutationsTable['id']
  entityRef: EntitiesTable['__ref']
  patch: ColumnType<Record<string, unknown>, string, string>
  $createdAt: GeneratedAlways<Timestamp>
  $updatedAt: Timestamp
}
