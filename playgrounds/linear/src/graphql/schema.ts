import { buildSchema } from 'graphql'

import schemaSdl from './schema.subset.graphql?raw'

export const schema = buildSchema(schemaSdl)
