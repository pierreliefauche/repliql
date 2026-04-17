import { Migration } from 'kysely'

import { MigrationInit } from './2026-04-16_init'

export const migrations: Record<string, Migration> = {
  '2026-04-16_init': MigrationInit,
}
