import { describe, expect, it, mock } from 'bun:test'

import { createRequest, gql, makeOperation, type Operation } from '@urql/core'

import { makeOperationsRegistry } from './operationsRegistry'

describe('operationsRegistry', () => {
  const doc = gql`
    query Q($n: Int!) {
      value(n: $n)
    }
  `

  const mutationDoc = gql`
    mutation M {
      doThing
    }
  `

  const ctx = { url: 'http://test', requestPolicy: 'cache-first' as const }

  function queryOp(n: number): Operation {
    return makeOperation('query', createRequest(doc, { n }), ctx)
  }

  function teardownOf(op: Operation): Operation {
    return makeOperation('teardown', op, ctx)
  }

  function sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms))
  }

  describe('immediate eviction', () => {
    it('adds once per key and exposes via get/entries', () => {
      const onAdd = mock((op: Operation) => ({ key: op.key }))
      const reg = makeOperationsRegistry({
        kinds: ['query'],
        eviction: { strategy: 'immediate' },
        onAdd,
      })

      const a = queryOp(1)
      reg.spy(a)
      reg.spy(a) // duplicate

      expect(onAdd).toHaveBeenCalledTimes(1)
      expect(reg.get(a.key)).toEqual({ key: a.key })
      expect(reg.entries()).toEqual([[a.key, { key: a.key }]])
    })

    it('evicts immediately on teardown and calls onEvict', () => {
      const onEvict = mock(() => {})
      const reg = makeOperationsRegistry({
        kinds: ['query'],
        eviction: { strategy: 'immediate' },
        onAdd: op => op.key,
        onEvict,
      })

      const a = queryOp(1)
      reg.spy(a)
      reg.spy(teardownOf(a))

      expect(reg.get(a.key)).toBeUndefined()
      expect(onEvict).toHaveBeenCalledWith(a.key, a.key)
    })

    it('ignores kinds not listed', () => {
      const onAdd = mock(() => 1)
      const reg = makeOperationsRegistry({
        kinds: ['query'],
        eviction: { strategy: 'immediate' },
        onAdd,
      })

      const m = makeOperation('mutation', createRequest(mutationDoc, {}), ctx)
      reg.spy(m)

      expect(onAdd).not.toHaveBeenCalled()
      expect(reg.get(m.key)).toBeUndefined()
    })
  })

  describe('delayed eviction', () => {
    it('evicts after delay', async () => {
      const onEvict = mock(() => {})
      const reg = makeOperationsRegistry({
        kinds: ['query'],
        eviction: { strategy: 'delayed', delayMs: 20 },
        onAdd: op => op.key,
        onEvict,
      })

      const a = queryOp(1)
      reg.spy(a)
      reg.spy(teardownOf(a))

      expect(reg.get(a.key)).toBe(a.key)
      await sleep(5)
      expect(reg.get(a.key)).toBe(a.key)
      await sleep(30)
      expect(reg.get(a.key)).toBeUndefined()
      expect(onEvict).toHaveBeenCalledTimes(1)
    })

    it('reactivation cancels pending eviction', async () => {
      const onEvict = mock(() => {})
      const reg = makeOperationsRegistry({
        kinds: ['query'],
        eviction: { strategy: 'delayed', delayMs: 10 },
        onAdd: op => op.key,
        onEvict,
      })

      const a = queryOp(1)
      reg.spy(a)
      reg.spy(teardownOf(a))
      reg.spy(a) // resurrect
      await sleep(25)

      expect(reg.get(a.key)).toBe(a.key)
      expect(onEvict).not.toHaveBeenCalled()
    })

    it('excludes evictable entries from entries() before timer fires', () => {
      const reg = makeOperationsRegistry({
        kinds: ['query'],
        eviction: { strategy: 'delayed', delayMs: 1000 },
        onAdd: op => op.key,
      })

      const a = queryOp(1)
      const b = queryOp(2)
      reg.spy(a)
      reg.spy(b)
      reg.spy(teardownOf(a))

      expect(reg.get(a.key)).toBe(a.key) // still in registry
      expect(reg.entries()).toEqual([[b.key, b.key]]) // but filtered out
    })
  })

  describe('lru eviction', () => {
    it('evicts the least-recently-used evictable entry when size exceeded', () => {
      const onEvict = mock(() => {})
      const reg = makeOperationsRegistry({
        kinds: ['query'],
        eviction: { strategy: 'lru', size: 2 },
        onAdd: op => op.key,
        onEvict,
      })

      const a = queryOp(1)
      const b = queryOp(2)
      const c = queryOp(3)

      reg.spy(a)
      reg.spy(b)
      reg.spy(teardownOf(a))
      reg.spy(teardownOf(b))
      reg.spy(c) // pushes lruQueue over size, a (oldest) evicted

      expect(reg.get(a.key)).toBeUndefined()
      expect(reg.get(b.key)).toBe(b.key)
      expect(reg.get(c.key)).toBe(c.key)
      expect(onEvict).toHaveBeenCalledWith(a.key, a.key)
    })

    it('re-executing an op moves it to the back of the queue', () => {
      const onEvict = mock(() => {})
      const reg = makeOperationsRegistry({
        kinds: ['query'],
        eviction: { strategy: 'lru', size: 2 },
        onAdd: op => op.key,
        onEvict,
      })

      const a = queryOp(1)
      const b = queryOp(2)
      const c = queryOp(3)

      reg.spy(a)
      reg.spy(b)
      reg.spy(a) // a becomes most recent
      reg.spy(teardownOf(a))
      reg.spy(teardownOf(b))
      reg.spy(c) // b is now the oldest evictable entry, gets evicted

      expect(reg.get(a.key)).toBe(a.key)
      expect(reg.get(b.key)).toBeUndefined()
      expect(reg.get(c.key)).toBe(c.key)
    })

    it('does not evict teardown-only keys that were never queried', () => {
      const onEvict = mock(() => {})
      const reg = makeOperationsRegistry({
        kinds: ['query'],
        eviction: { strategy: 'lru', size: 1 },
        onAdd: op => op.key,
        onEvict,
      })

      const a = queryOp(1)
      reg.spy(a)
      reg.spy(teardownOf(a))

      // nothing triggers the lru check, so a stays
      expect(reg.get(a.key)).toBe(a.key)
      expect(onEvict).not.toHaveBeenCalled()
    })

    it('teardown alone does not evict under lru', () => {
      const reg = makeOperationsRegistry({
        kinds: ['query'],
        eviction: { strategy: 'lru', size: 10 },
        onAdd: op => op.key,
      })

      const a = queryOp(1)
      reg.spy(a)
      reg.spy(teardownOf(a))

      expect(reg.get(a.key)).toBe(a.key)
      expect(reg.entries()).toEqual([]) // filtered out, evictable
    })
  })

  describe('setIfPresent', () => {
    it('updates only when the key exists', () => {
      const reg = makeOperationsRegistry<number>({
        kinds: ['query'],
        eviction: { strategy: 'immediate' },
        onAdd: () => 0,
      })

      const a = queryOp(1)
      reg.spy(a)
      reg.setIfPresent(a.key, 42)
      expect(reg.get(a.key)).toBe(42)

      reg.setIfPresent(999, 99)
      expect(reg.get(999)).toBeUndefined()
    })
  })
})
