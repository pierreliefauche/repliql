import { Operation } from '@urql/core'

export interface OperationsRegistry<T> {
  spy: (operation: Operation) => void
  get: (operationKey: number) => undefined | T
  has: (operationKey: number) => boolean
  entries: () => [number, T][]
  setIfPresent: (operationKey: number, value: T) => void
}

export type EvictionConfig =
  | { strategy: 'immediate' }
  | { strategy: 'delayed'; delayMs: number }
  | { strategy: 'lru'; size: number }

interface OperationsRegistryConfig<T> {
  kinds: Exclude<Operation['kind'], 'teardown'>[]
  eviction: EvictionConfig
  onAdd: (operation: Operation) => T
  onEvict?: (operationKey: number, value: T) => void
}

export function makeOperationsRegistry<T>(
  config: OperationsRegistryConfig<T>,
): OperationsRegistry<T> {
  const { kinds, onAdd, onEvict, eviction } = config

  const registry = new Map<number, T>()
  const evictableKeys = new Set<number>()
  const evictionTimers = new Map<number, ReturnType<typeof setTimeout>>()
  const lruQueue = new Set<number>()

  function evict(operationKey: number) {
    lruQueue.delete(operationKey)

    if (!evictableKeys.has(operationKey)) {
      return
    }

    const value = registry.get(operationKey) as T
    registry.delete(operationKey)
    evictableKeys.delete(operationKey)

    onEvict?.(operationKey, value)
  }

  function scheduleEviction(key: number) {
    if (evictableKeys.has(key)) {
      return
    }

    evictableKeys.add(key)

    if (eviction.strategy === 'delayed') {
      if (!evictionTimers.has(key)) {
        evictionTimers.set(
          key,
          setTimeout(() => evict(key), eviction.delayMs),
        )
      }
    } else if (eviction.strategy === 'lru') {
      // Do nothing
    } else {
      eviction.strategy satisfies 'immediate'
      evict(key)
    }
  }

  function spy(operation: Operation): void {
    const { key, kind } = operation

    if (kind === 'teardown') {
      scheduleEviction(key)
    } else if (kinds.includes(kind)) {
      if (!registry.has(key)) {
        registry.set(key, onAdd(operation))
      }

      evictableKeys.delete(key)
      clearTimeout(evictionTimers.get(key))
      evictionTimers.delete(key)

      if (eviction.strategy === 'lru') {
        lruQueue.delete(key)
        lruQueue.add(key)

        while (lruQueue.size > eviction.size) {
          const oldest = lruQueue.values().next().value!
          evict(oldest)
        }
      }
    }
  }

  return {
    spy,
    get(operationKey: number) {
      return registry.get(operationKey)
    },
    has(operationKey: number) {
      return registry.has(operationKey)
    },
    entries() {
      return [...registry.entries()].filter(([key]) => !evictableKeys.has(key))
    },
    setIfPresent(operationKey: number, value: T) {
      if (registry.has(operationKey)) {
        registry.set(operationKey, value)
      }
    },
  }
}
