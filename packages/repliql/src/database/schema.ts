import type { Entity, EntityRef } from '@repliql/utils'
import type { Operation } from '@urql/core'
import type { ColumnType, GeneratedAlways, JSONColumnType } from 'kysely'

type ReadOnly<T> =
  T extends ColumnType<infer S, infer I, any> ? ColumnType<S, I, never> : ColumnType<T, T, never>

type Timestamp = ColumnType<Date, Date | string, Date | string>

export const ENTITIES_TABLE_NAME: keyof DatabaseSchema = 'entities' as const

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
  data: JSONColumnType<Entity>
  base: null | JSONColumnType<Entity>
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
  variables: ReadOnly<JSONColumnType<NonNullable<Operation['variables']>>>
  context: ReadOnly<JSONColumnType<Operation['context']>>
  extensions: ReadOnly<JSONColumnType<NonNullable<Operation['extensions']>>>
  status: MutationStatus
  $createdAt: GeneratedAlways<Timestamp>
  $updatedAt: Timestamp
}

export type MutationPatchesTable = {
  mutationId: MutationsTable['id']
  entityRef: EntitiesTable['__ref']
  patch: JSONColumnType<Record<string, unknown>>
  $createdAt: GeneratedAlways<Timestamp>
  $updatedAt: Timestamp
}
