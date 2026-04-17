import type { ReactiveKysely } from '@repliql/reactive-kysely'
import { Entity, isPrimitive, Primitive } from '@repliql/utils'
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

  public async getEntitiesByRef(args: { entityRefs: readonly string[] }) {
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

  public getEntitiesPointersQuery(args: {
    __typename: string | [string, ...string[]]
    where: DataFilter
  }) {
    const { __typename, where } = args

    const typenames: string[] = typeof __typename === 'string' ? [__typename] : __typename
    if (!typenames.length) {
      throw new Error('Missing __typename to find entities')
    }

    let query = this.client
      .selectFrom('entities')
      .select('__ref')
      .where('__typename', 'in', typenames)

    const conditions = dataFilterToConditions(where)

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

    return query
  }
}

type DataFilter = { [key: string]: DataFilter | Primitive | { $in: Primitive[] } }

type FilterCondition = { operator: '='; value: Primitive } | { operator: 'in'; value: Primitive[] }

function isValidPath(path: string[]): path is [string, ...string[]] {
  return path.length > 0
}

function dataFilterToConditions(
  dataFilter: DataFilter,
): { path: string[]; condition: FilterCondition }[] {
  const results: { path: string[]; condition: FilterCondition }[] = []

  function traverse(filter: DataFilter, currentPath: string[]) {
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
        // Nested DataFilter
        value satisfies DataFilter
        traverse(value, newPath)
      }
    }
  }

  traverse(dataFilter, [])
  return results
}
