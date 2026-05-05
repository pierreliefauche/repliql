import type { ReactiveKysely } from '@repliql/reactive-kysely'
import { toJsonbPreserveNulls } from '@repliql/reactive-kysely'
import { Entity, EntityRef, getEntityRef, isPrimitive, Primitive } from '@repliql/utils'
import { type MigrationResultSet, Migrator, Selectable, sql, Transaction } from 'kysely'

import {
  ACTIVE_MUTATION_STATUSES,
  ENTITIES_TABLE_NAME,
  RESOLVED_MUTATION_STATUSES,
  type DatabaseSchema,
  type MutationStatus,
  type ResolvedMutationStatus,
} from './schema'

type FullTextSearchIndexes = {
  [EntityTypename: string]: string[]
}

type DatabaseConfig<DB extends DatabaseSchema = DatabaseSchema> = {
  kysely: ReactiveKysely<DB>
  fts?: FullTextSearchIndexes
}

export type Mutation = Selectable<DatabaseSchema['mutations']>

export class Database<DB extends DatabaseSchema = DatabaseSchema> {
  private kysely: ReactiveKysely<DB>

  private initPromise: undefined | Promise<void>

  protected fullTextSearchIndexes: FullTextSearchIndexes

  constructor({ kysely, fts }: DatabaseConfig<DB>) {
    this.kysely = kysely
    this.fullTextSearchIndexes = fts || {}
  }

  public async init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = Promise.resolve().then(async () => {
        await this.configure()
        await this.migrate()
        await this.createFullTextSearchIndexes()
      })
    }

    return this.initPromise
  }

  protected async configure() {
    await sql`
          -- Enable cascading deletes
          PRAGMA foreign_keys = ON;
          -- WAL mode for better concurrency
          PRAGMA journal_mode = WAL;
          -- Increase cache size (in pages, default is 2000)
          PRAGMA cache_size = 10000;
          -- Disable synchronous writes for better performance
          -- Level 1 is a good balance between safety and performance
          PRAGMA synchronous = NORMAL;
          -- Increase page size for better read performance (default 4096)
          PRAGMA page_size = 8192;
          -- Enable memory-mapped I/O for reading
          PRAGMA mmap_size = 268435456;
          -- Optimize for sequential writes
          PRAGMA temp_store = MEMORY;
      `.execute(this.kysely)
  }

  protected async migrate(): Promise<MigrationResultSet> {
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

    return migrator.migrateToLatest()
  }

  private async createFullTextSearchIndexes() {
    for (const [__typename, fields] of Object.entries(this.fullTextSearchIndexes)) {
      const ftsTableName = getFtsTableName(__typename)
      const insertTriggerName = `${ftsTableName}_insert`
      const updateTriggerName = `${ftsTableName}_update`
      const deleteTriggerName = `${ftsTableName}_delete`
      const ftsColumns = sql.join(fields.map(field => sql.ref(field)))
      const dataFieldValues = (table: string) =>
        sql.join(fields.map(field => sql`${sql.ref(`${table}.data`)}->${sql.lit(field)}`))

      // Drop existing FTS table and triggers
      await sql`
        DROP TRIGGER IF EXISTS ${sql.table(insertTriggerName)};
        DROP TRIGGER IF EXISTS ${sql.table(updateTriggerName)};
        DROP TRIGGER IF EXISTS ${sql.table(deleteTriggerName)};
        DROP TABLE IF EXISTS ${sql.table(ftsTableName)}
      `.execute(this.kysely)

      // Create FTS table (contentless_delete - we manage content via triggers)
      // https://www.sqlite.org/fts5.html#contentless_delete_tables
      await sql`
        CREATE VIRTUAL TABLE ${sql.table(ftsTableName)} USING fts5(
          ${ftsColumns},
          tokenize='unicode61 remove_diacritics 2',
          content='',
          contentless_delete=1
        );
      `.execute(this.kysely)

      // Create triggers
      await sql`
        CREATE TRIGGER ${sql.table(insertTriggerName)} 
        AFTER INSERT ON ${sql.table(ENTITIES_TABLE_NAME)} 
        WHEN ${sql.ref('NEW.__typename')} = ${sql.lit(__typename)}
        BEGIN
          INSERT INTO ${sql.table(ftsTableName)} (rowid, ${ftsColumns})
          VALUES (NEW.rowid, ${dataFieldValues('NEW')}); 
        END;
      `.execute(this.kysely)

      await sql`
        CREATE TRIGGER ${sql.table(updateTriggerName)} 
        AFTER UPDATE ON ${sql.table(ENTITIES_TABLE_NAME)} 
        WHEN ${sql.ref('NEW.__typename')} = ${sql.lit(__typename)} OR ${sql.ref('OLD.__typename')} = ${sql.lit(__typename)}
        BEGIN
          INSERT OR REPLACE INTO ${sql.table(ftsTableName)} (rowid, ${ftsColumns})
          SELECT NEW.rowid, ${dataFieldValues('NEW')}
          WHERE ${sql.ref('NEW.__typename')} = ${sql.lit(__typename)};

          DELETE FROM ${sql.table(ftsTableName)} 
          WHERE ${sql.ref(`${ftsTableName}.rowid`)} = OLD.rowid 
            AND ${sql.ref('NEW.__typename')} != ${sql.lit(__typename)};
        END;
      `.execute(this.kysely)

      await sql`
        CREATE TRIGGER ${sql.table(deleteTriggerName)} 
        AFTER DELETE ON ${sql.table(ENTITIES_TABLE_NAME)} 
        WHEN ${sql.ref('OLD.__typename')} = ${sql.lit(__typename)}
        BEGIN
          DELETE FROM ${sql.table(ftsTableName)} WHERE ${sql.ref(`${ftsTableName}.rowid`)} = OLD.rowid; 
        END;
      `.execute(this.kysely)

      // Populate index with existing entities
      await sql`
        INSERT INTO ${sql.table(ftsTableName)} (rowid, ${ftsColumns})
        SELECT rowid, ${dataFieldValues(ENTITIES_TABLE_NAME)}
        FROM ${sql.table(ENTITIES_TABLE_NAME)}
        WHERE ${sql.ref('__typename')} = ${sql.lit(__typename)}
      `.execute(this.kysely)
    }
  }

  public get client(): ReactiveKysely<DatabaseSchema> {
    return this.kysely as unknown as ReactiveKysely<DatabaseSchema>
  }

  public async upsertEntities(args: {
    trx?: Transaction<DatabaseSchema>
    entities: Entity[]
    byOperationKey: number
    isOptimistic: boolean
  }) {
    const { trx, entities, byOperationKey, isOptimistic } = args
    if (entities.length === 0) {
      return
    }

    const db = trx || this.client

    const $updatedAt = new Date().toISOString()
    const values = entities.map(data => ({
      __typename: data.__typename,
      id: data.id,
      __ref: getEntityRef(data),
      data: toJsonbPreserveNulls(data),
      base: isOptimistic ? toJsonbPreserveNulls({}) : null,
      $updatedAt,
      updatedByOperationKey: byOperationKey,
    }))

    const q = db
      .insertInto('entities')
      .values(values)
      .onConflict(oc =>
        oc.columns(['__typename', 'id']).doUpdateSet(eb => ({
          ...(isOptimistic
            ? {
                // Make sure base is populated
                base: eb.fn.coalesce(eb.ref('entities.base'), eb.ref('entities.data')),
                // Patch data
                data: sql`json_patch(${eb.ref('entities.data')}, ${eb.ref('excluded.data')})`,
              }
            : {
                // Patch base if base exists
                base: sql`IIF(${eb.ref('entities.base')} IS NOT NULL, json_patch(${eb.ref('entities.base')}, ${eb.ref('excluded.data')}), NULL)`,
                // otherwise patch data if base does not exist
                data: sql`IIF(${eb.ref('entities.base')} IS NULL, json_patch(${eb.ref('entities.data')}, ${eb.ref('excluded.data')}), ${eb.ref('entities.data')})`,
              }),
          updatedByOperationKey: eb.ref('excluded.updatedByOperationKey'),
          $updatedAt: eb.ref('excluded.$updatedAt'),
        })),
      )
      .returningAll()

    return q.execute()
  }

  public async upsertQueries(args: {
    queries: { id: string; data: unknown }[]
    byOperationKey: number
  }) {
    const { queries, byOperationKey } = args
    if (queries.length === 0) {
      return
    }

    const $updatedAt = new Date().toISOString()
    const values = queries.map(({ id, data }) => ({
      id,
      data: toJsonbPreserveNulls(data),
      $updatedAt,
      updatedByOperationKey: byOperationKey,
    }))

    await this.client
      .insertInto('queries')
      .values(values)
      .onConflict(oc =>
        oc.columns(['id']).doUpdateSet(eb => ({
          data: eb.ref('excluded.data'),
          updatedByOperationKey: eb.ref('excluded.updatedByOperationKey'),
          $updatedAt: eb.ref('excluded.$updatedAt'),
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
    fullTextSearch?: string
    orderBy?: OrderByEntityData
    limit?: number
  }) {
    const { __typename, where, orderBy, limit, fullTextSearch } = args

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

    if (fullTextSearch) {
      const ftsTypenames = typenames.filter(t => t in this.fullTextSearchIndexes)

      if (ftsTypenames.length === 0) {
        throw new Error(
          `No full-text search index exists for any of the types: ${typenames.join(', ')}`,
        )
      }

      // Build subqueries for each FTS table
      const ftsSubqueries = ftsTypenames.map(typename => {
        const ftsTableName = getFtsTableName(typename)
        return sql<{
          rowid: number
        }>`(SELECT rowid FROM ${sql.table(ftsTableName)} WHERE ${sql.table(ftsTableName)} MATCH ${fullTextSearch})`
      })

      // Combine with UNION ALL if multiple, otherwise just use the single subquery
      const combinedSubquery =
        ftsSubqueries.length === 1
          ? ftsSubqueries[0]!
          : sql<{ rowid: number }>`(${sql.join(ftsSubqueries, sql` UNION ALL `)})`

      query = query.where(() => sql`entities.rowid IN ${combinedSubquery}`)
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

  public async insertMutation(args: {
    id: string
    name: string | null
    query: string
    variables: Record<string, unknown>
    extensions: Record<string, unknown>
    context: Record<string, unknown>
    status: MutationStatus
  }) {
    const { id, name, query, variables, extensions, context, status } = args

    const mutation = await this.client
      .insertInto('mutations')
      .values([
        {
          id,
          name,
          query,
          variables: JSON.stringify(variables),
          extensions: JSON.stringify(extensions),
          context: JSON.stringify(context),
          status,
          $updatedAt: new Date().toISOString(),
        },
      ])
      .returningAll()
      .executeTakeFirst()

    return mutation
  }

  public async patchEntities(args: {
    mutationId: string
    byOperationKey: number
    entities: Entity[]
  }) {
    const { mutationId, entities, byOperationKey } = args

    // Record mutation patch
    const $updatedAt = new Date().toISOString()

    return this.client.transaction().execute(async trx => {
      await trx
        .insertInto('mutationPatches')
        .values(
          entities.map(({ __typename, id, ...patch }) => ({
            mutationId,
            entityRef: getEntityRef({ __typename, id }),
            patch: toJsonbPreserveNulls(patch),
            $updatedAt,
          })),
        )
        .onConflict(oc =>
          oc.columns(['mutationId', 'entityRef']).doUpdateSet(eb => ({
            patch: eb.ref('excluded.patch'),
            $updatedAt: eb.ref('excluded.$updatedAt'),
          })),
        )
        .execute()

      // Patch entities
      return await this.upsertEntities({
        trx,
        byOperationKey,
        isOptimistic: true,
        entities,
      })
    })
  }

  public async claimNextPendingMutation() {
    return this.client
      .updateTable('mutations')
      .set('status', 'inflight')
      .set('$updatedAt', new Date().toISOString())
      .where('id', '=', eb =>
        eb
          .selectFrom('mutations')
          .select('id')
          .where('status', '=', 'pending')
          .where(eb =>
            eb.not(
              eb.exists(
                eb
                  .selectFrom('mutations as m2')
                  .select('m2.id')
                  .where('m2.status', '=', 'inflight'),
              ),
            ),
          )
          .orderBy('$createdAt', 'asc')
          .limit(1),
      )
      .returningAll()
      .executeTakeFirst()
  }

  public async requeueInflightMutations() {
    await this.client
      .updateTable('mutations')
      .set('status', 'pending')
      .set('$updatedAt', new Date().toISOString())
      .where('status', '=', 'inflight')
      .execute()
  }

  public async requeueInflightMutation(mutationId: string) {
    await this.client
      .updateTable('mutations')
      .set('status', 'pending')
      .set('$updatedAt', new Date().toISOString())
      .where('status', '=', 'inflight')
      .where('id', '=', mutationId)
      .execute()
  }

  async resolveMutation(args: { mutationId: string; status: ResolvedMutationStatus }) {
    const { mutationId, status } = args

    // Change mutation status
    const mutation = await this.client
      .updateTable('mutations')
      .set('$updatedAt', new Date().toISOString())
      .set('status', status)
      .where('id', '=', mutationId)
      .returningAll()
      .executeTakeFirst()

    // Clean-up mutated entities
    await this.cleanEntityBases({ onlyMutationId: mutationId })

    return mutation
  }

  async cleanEntityBases(args?: { onlyMutationId?: string }) {
    const { onlyMutationId } = args ?? {}

    return await this.client
      .updateTable('entities')
      // @ts-ignore
      .set('data', eb => eb.ref('base'))
      .set('base', null)
      .set('$updatedAt', new Date().toISOString())
      // Has a `base` data
      .where('base', 'is not', null)
      // but no active patches
      .where('__ref', 'not in', eb =>
        eb
          .selectFrom('mutationPatches')
          .select('mutationPatches.entityRef')
          .innerJoin('mutations', 'mutations.id', 'mutationPatches.mutationId')
          .where('status', 'in', ACTIVE_MUTATION_STATUSES),
      )
      // Optionally look only at entities touched by a specific mutations
      .$if(!!onlyMutationId, eb =>
        eb.where('__ref', 'in', eb =>
          eb
            .selectFrom('mutationPatches')
            .select('entityRef')
            .where('mutationId', '=', onlyMutationId!),
        ),
      )
      .execute()
  }

  async reapplyAllMutationPatches() {
    return await this.client
      // 1. Create the ordered sequence of patches
      .with('ordered_patches', db =>
        db
          .selectFrom('mutationPatches')
          .select(['entityRef', 'patch'])
          .select(eb =>
            sql<number>`${eb.fn.countAll()} OVER (PARTITION BY ${eb.ref('entityRef')})`.as(
              'total_patches',
            ),
          )
          .select(eb =>
            sql<number>`row_number() OVER (PARTITION BY ${eb.ref('entityRef')} ORDER BY "mutationPatches".rowid)`.as(
              'rn',
            ),
          )
          .innerJoin('mutations', 'mutations.id', 'mutationPatches.mutationId')
          .where('status', 'in', ACTIVE_MUTATION_STATUSES),
      )
      // 2. Recursively apply json_patch
      .withRecursive('patch_chain', db =>
        db
          .selectFrom('entities')
          // ⚠️ ORDER OF SELECTION MUST MATCH ORDER BELOW ⚠️
          .select(`__ref as entity_ref`)
          .select(`base as current_data`)
          .select(sql<number>`0`.as('current_rn'))
          // Subquery to get max count for the base case
          .select(eb =>
            eb
              .selectFrom('ordered_patches')
              .select(eb.fn.countAll().as('count'))
              .whereRef('ordered_patches.entityRef', '=', 'entities.__ref')
              .as('max_rn'),
          )
          // Only include entities that actually have patches
          .where('base', 'is not', null)
          .where('entities.__ref', 'in', eb =>
            eb.selectFrom('ordered_patches').select('ordered_patches.entityRef'),
          )
          .unionAll(db =>
            db
              .selectFrom('patch_chain')
              .innerJoin('ordered_patches', join =>
                join
                  .onRef('ordered_patches.entityRef', '=', 'patch_chain.entity_ref')
                  .onRef(
                    'ordered_patches.rn',
                    '=',
                    eb => sql`${eb.ref('patch_chain.current_rn')} + 1`,
                  ),
              )
              // ⚠️ ORDER OF SELECTION MUST MATCH ORDER ABOVE ⚠️
              .select('patch_chain.entity_ref')
              .select(eb =>
                sql<Entity>`json_patch(${eb.ref('patch_chain.current_data')}, ${eb.ref('ordered_patches.patch')})`.as(
                  'current_data',
                ),
              )
              .select('ordered_patches.rn as current_rn')
              .select('patch_chain.max_rn'),
          ),
      )
      // 3. Perform the Update
      .updateTable('entities')
      .set('data', eb =>
        eb
          .selectFrom('patch_chain')
          .select(eb => sql<string>`${eb.ref('patch_chain.current_data')}`.as('current_data'))
          .whereRef('patch_chain.entity_ref', '=', 'entities.__ref')
          .whereRef('patch_chain.current_rn', '=', 'patch_chain.max_rn'),
      )
      .where('entities.__ref', 'in', eb =>
        eb.selectFrom('patch_chain').select('patch_chain.entity_ref'),
      )
      .execute()
  }

  async purgeResolvedMutations() {
    await this.client
      .deleteFrom('mutations')
      .where('status', 'in', RESOLVED_MUTATION_STATUSES)
      .execute()
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

function getFtsTableName(__typename: string): string {
  return `repliql_fts_${__typename}`
}
