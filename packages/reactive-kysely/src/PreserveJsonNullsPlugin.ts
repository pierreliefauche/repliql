import { isPrimitive } from '@repliql/utils'
import type {
  KyselyPlugin,
  PluginTransformQueryArgs,
  PluginTransformResultArgs,
  UnknownRow,
} from 'kysely'

const NULL = '$null$' as const

export class PreserveJsonNullsPlugin implements KyselyPlugin {
  // noop
  transformQuery(args: PluginTransformQueryArgs) {
    return args.node
  }

  async transformResult(args: PluginTransformResultArgs) {
    return {
      ...args.result,
      rows: transform(args.result.rows, NULL, null) as UnknownRow[],
    }
  }
}

export function toJsonbPreserveNulls(input: unknown): string {
  return JSON.stringify(preserveJsonNulls(input))
}

export function preserveJsonNulls<I>(input: I): I {
  return transform(input, null, NULL) as I
}

function transform<From, To>(obj: unknown, from: From, to: To): unknown {
  if (obj === from) {
    return to
  }

  if (Array.isArray(obj)) {
    return obj.map(v => transform(v, from, to))
  }

  if (!isPrimitive(obj) && typeof obj === 'object' && String(obj) === '[object Object]') {
    for (const key in obj) {
      if (!Object.hasOwn(obj, key)) continue
      // @ts-expect-error
      obj[key] = transform(obj[key], from, to)
    }
  }

  return obj
}
