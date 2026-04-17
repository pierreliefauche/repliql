import { type Kysely, type Migration, sql } from 'kysely'

export const MigrationInit: Migration = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .createTable('entities')
      .addColumn('__typename', 'text', col => col.notNull())
      .addColumn('id', 'text', col => col.notNull())
      .addColumn('__ref', 'text', col => col.notNull())
      .addColumn('data', 'jsonb', col => col.notNull().defaultTo('{}'))
      .addColumn('updatedByOperationKey', 'integer')
      .addColumn('createdAt', 'text', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .addColumn('updatedAt', 'text', col => col.notNull())
      .addPrimaryKeyConstraint('entities_pk', ['__typename', 'id'])
      .addUniqueConstraint('entities__ref_unique', ['__ref'])
      .execute()

    await db.schema
      .createTable('queries')
      .addColumn('id', 'text', col => col.notNull())
      .addColumn('data', 'jsonb', col => col.notNull().defaultTo('{}'))
      .addColumn('updatedByOperationKey', 'integer')
      .addColumn('createdAt', 'text', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .addColumn('updatedAt', 'text', col => col.notNull())
      .addPrimaryKeyConstraint('entities_pk', ['id'])
      .execute()
  },
  async down(db: Kysely<unknown>) {
    await db.schema.dropTable('queries').execute()
    await db.schema.dropTable('entities').execute()
  },
}
