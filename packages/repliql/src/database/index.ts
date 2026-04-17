import type { ReactiveKysely } from '@repliql/reactive-kysely'
import { Entity, EntityRef, getEntityRef, isPrimitive, Primitive } from '@repliql/utils'
import { type MigrationResultSet, Migrator, sql } from 'kysely'

import type { DatabaseSchema } from './schema'

type DatabaseConfig<DB extends DatabaseSchema = DatabaseSchema> = {
  kysely: ReactiveKysely<DB>
}

export class Database<DB extends DatabaseSchema = DatabaseSchema> {
  private kysely: ReactiveKysely<DB>

  private migrationPromise: undefined | Promise<MigrationResultSet>

  constructor({ kysely }: DatabaseConfig<DB>) {
    this.kysely = kysely
  }

  public async migrate(): Promise<MigrationResultSet> {
    if (!this.migrationPromise) {
      const migrator = new Migrator({
        db: this.kysely,
        migrationTableName: 'repliql_kysely_migration',
        provider: {
          async getMigrations() {
            const { migrations } = await import('./migrations')
            return migrations
          },
        },
      })

      this.migrationPromise = migrator.migrateToLatest()
    }

    return this.migrationPromise
  }

  public get client(): ReactiveKysely<DatabaseSchema> {
    return this.kysely as unknown as ReactiveKysely<DatabaseSchema>
  }

  public async upsertEntities(args: { entities: Entity[]; byOperationKey: number }) {
    const { entities, byOperationKey } = args
    if (entities.length === 0) {
      return
    }

    const updatedAt = new Date().toISOString()
    const values = entities.map(data => ({
      __typename: data.__typename,
      id: data.id,
      __ref: getEntityRef(data),
      data: JSON.stringify(data),
      updatedAt,
      updatedByOperationKey: byOperationKey,
    }))

    await this.client
      .insertInto('entities')
      .values(values)
      .onConflict(oc =>
        oc.columns(['__typename', 'id']).doUpdateSet(eb => ({
          data: sql`json_patch(${eb.ref('entities.data')}, ${eb.ref('excluded.data')})`,
          updatedByOperationKey: eb.ref('excluded.updatedByOperationKey'),
          updatedAt: eb.ref('excluded.updatedAt'),
        })),
      )
      .execute()
  }

  public async upsertQueries(args: {
    queries: { id: string; data: unknown }[]
    byOperationKey: number
  }) {
    const { queries, byOperationKey } = args
    if (queries.length === 0) {
      return
    }

    const updatedAt = new Date().toISOString()
    const values = queries.map(({ id, data }) => ({
      id,
      data: JSON.stringify(data),
      updatedAt,
      updatedByOperationKey: byOperationKey,
    }))

    await this.client
      .insertInto('queries')
      .values(values)
      .onConflict(oc =>
        oc.columns(['id']).doUpdateSet(eb => ({
          data: eb.ref('excluded.data'),
          updatedByOperationKey: eb.ref('excluded.updatedByOperationKey'),
          updatedAt: eb.ref('excluded.updatedAt'),
        })),
      )
      .execute()
  }

  public async getQueriesById(args: { queryIds: readonly string[] }) {
    const { queryIds } = args
    if (!queryIds.length) {
      return []
    }

    const result = await this.client
      .selectFrom('queries')
      .select(['id', 'data'])
      .where('id', 'in', queryIds)
      .execute()

    return result
  }

  public async getEntitiesByRef(args: { entityRefs: readonly EntityRef[] }) {
    const { entityRefs } = args
    if (!entityRefs.length) {
      return []
    }

    const result = await this.client
      .selectFrom('entities')
      .select(['__typename', 'id', 'data', '__ref'])
      .where('__ref', 'in', entityRefs)
      .execute()

    return result
  }

  public selectEntityPointersQuery(args: {
    __typename: string | [string, ...string[]]
    where?: WhereEntityData
    orderBy?: OrderByEntityData
    limit?: number
  }) {
    const { __typename, where, orderBy, limit } = args

    const typenames: string[] = typeof __typename === 'string' ? [__typename] : __typename
    if (!typenames.length) {
      throw new Error('Missing __typename to find entities')
    }

    let query = this.client
      .selectFrom('entities')
      .select('__ref')
      .where('__typename', 'in', typenames)

    if (where) {
      const conditions = whereEntityDataToConditions(where)

      for (const { path, condition } of conditions) {
        if (isValidPath(path)) {
          query = query.where(
            eb => {
              const [firstKey, ...otherKeys] = path
              let field = eb.ref('data', '->>').key(firstKey)

              for (const key of otherKeys) {
                // @ts-expect-error
                field = field.key(key)
              }

              return field
            },
            condition.operator,
            // @ts-expect-error
            condition.value,
          )
        }
      }
    }

    if (orderBy) {
      const sorts = orderByEntityDataToOrders(orderBy)

      for (const { path, sortOrder } of sorts) {
        if (isValidPath(path)) {
          query = query.orderBy(eb => {
            const [firstKey, ...otherKeys] = path
            let field = eb.ref('data', '->>').key(firstKey)

            for (const key of otherKeys) {
              // @ts-expect-error
              field = field.key(key)
            }

            return field
          }, sortOrder)
        }
      }
    }

    if (limit) {
      query = query.limit(limit)
    }

    return query
  }
}

type SortOrder = 'asc' | 'desc'

type WhereEntityData = { [key: string]: WhereEntityData | Primitive | { $in: Primitive[] } }
type OrderByEntityData = { [key: string]: OrderByEntityData | SortOrder }

type FilterCondition = { operator: '='; value: Primitive } | { operator: 'in'; value: Primitive[] }

function isValidPath(path: string[]): path is [string, ...string[]] {
  return path.length > 0
}

function whereEntityDataToConditions(
  where: WhereEntityData,
): { path: string[]; condition: FilterCondition }[] {
  const results: { path: string[]; condition: FilterCondition }[] = []

  function traverse(filter: WhereEntityData, currentPath: string[]) {
    for (const [key, value] of Object.entries(filter)) {
      const newPath = [...currentPath, key]

      if (isPrimitive(value)) {
        // Primitive value - equality check
        results.push({
          path: newPath,
          condition: { operator: '=', value: value as Primitive },
        })
      } else if ('$in' in value) {
        // $in condition
        if (Array.isArray(value.$in)) {
          results.push({
            path: newPath,
            condition: { operator: 'in', value: value.$in },
          })
        } else {
          throw new Error('Invalid data filter $in values')
        }
      } else {
        // Nested WhereEntityData
        value satisfies WhereEntityData
        traverse(value, newPath)
      }
    }
  }

  traverse(where, [])
  return results
}

function orderByEntityDataToOrders(
  orderBy: OrderByEntityData,
): { path: string[]; sortOrder: SortOrder }[] {
  const results: { path: string[]; sortOrder: SortOrder }[] = []

  function traverse(orderBy: OrderByEntityData, currentPath: string[]) {
    for (const [key, value] of Object.entries(orderBy)) {
      const newPath = [...currentPath, key]

      if (value === 'asc' || value === 'desc') {
        results.push({
          path: newPath,
          sortOrder: value,
        })
      } else {
        // Nested OrderByEntityData
        value satisfies OrderByEntityData
        traverse(value, newPath)
      }
    }
  }

  traverse(orderBy, [])
  return results
}
