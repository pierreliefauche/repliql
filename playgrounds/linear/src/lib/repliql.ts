import { repliqlExchange } from '@repliql/repliql'
// import { schema } from '../graphql/schema'

import { kysely } from './kysely'
import { resolvers } from './resolvers'

export const repliql = repliqlExchange({
  kysely,
  // schema,
  resolvers,
})
