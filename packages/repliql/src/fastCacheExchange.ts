import { makeOperationsRegistry, type OperationsRegistryEviction } from '@repliql/utils'
import { makeResult, OperationResult, type Exchange } from '@urql/core'
import { merge, pipe, tap, map, filter } from 'wonka'

interface FastCacheConfig {
  eviction: OperationsRegistryEviction
}

export function fastCacheExchange({ eviction }: FastCacheConfig): Exchange {
  return ({ forward }) => {
    return operations$ => {
      const registry = makeOperationsRegistry<
        undefined | Pick<OperationResult, 'data' | 'hasNext' | 'stale'>
      >({
        kinds: ['query'],
        eviction,
        onAdd: () => undefined,
      })

      const cachedResults = pipe(
        operations$,
        tap(registry.spy),
        map(operation => {
          if (operation.kind === 'query' && operation.context.requestPolicy !== 'network-only') {
            const cached = registry.get(operation.key)
            if (cached) {
              const result = makeResult(operation, { data: cached.data, hasNext: cached.hasNext })
              result.stale = cached.stale
              return result
            }
          }
          return undefined
        }),
        filter(result => !!result),
      )

      const forwardedResults = pipe(
        operations$,
        forward,
        tap(result => {
          if (!result.error && result.data) {
            registry.setIfPresent(result.operation.key, {
              data: result.data,
              hasNext: result.hasNext,
              stale: result.stale,
            })
          }
        }),
      )

      return merge([forwardedResults, cachedResults])
    }
  }
}
