import { repliqlExchange } from '@repliql/repliql'

import { schema } from '../graphql/schema'

import { kysely } from './kysely'

export const repliql = repliqlExchange({
  kysely,
  schema,
  resolvers: { Query: {}, Mutation: {} },
})
