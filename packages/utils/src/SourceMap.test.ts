import { describe, expect, it, mock } from 'bun:test'

import { makeSubject, type Source } from 'wonka'

import { phash } from './hash'
import { SourceMap } from './SourceMap'

const makeSource = <T = number>(): Source<T> => makeSubject<T>().source

describe('SourceMap', () => {
  describe('get', () => {
    it('returns undefined for an unknown key', () => {
      const map = new SourceMap<number>()
      expect(map.get(phash('missing'))).toBeUndefined()
    })

    it('returns the source previously stored under the key', () => {
      const map = new SourceMap<number>()
      const source = makeSource()
      const key = phash('a')
      map.getOrCreate(key, () => source)
      expect(map.get(key)).toBe(source)
    })
  })

  describe('getOrCreate', () => {
    it('invokes the factory and stores the source when the key is missing', () => {
      const map = new SourceMap<number>()
      const source = makeSource()
      const factory = mock(() => source)
      const result = map.getOrCreate(phash('a'), factory)
      expect(result).toBe(source)
      expect(factory).toHaveBeenCalledTimes(1)
    })

    it('returns the existing source without calling the factory on repeat calls', () => {
      const map = new SourceMap<number>()
      const source = makeSource()
      const key = phash('a')
      map.getOrCreate(key, () => source)
      const factory = mock(() => makeSource())
      const result = map.getOrCreate(key, factory)
      expect(result).toBe(source)
      expect(factory).not.toHaveBeenCalled()
    })

    it('keeps entries for different keys independent', () => {
      const map = new SourceMap<number>()
      const sourceA = makeSource()
      const sourceB = makeSource()
      map.getOrCreate(phash('a'), () => sourceA)
      map.getOrCreate(phash('b'), () => sourceB)
      expect(map.get(phash('a'))).toBe(sourceA)
      expect(map.get(phash('b'))).toBe(sourceB)
    })

    it('supports string keys', () => {
      const map = new SourceMap<number, string>()
      const source = makeSource()
      map.getOrCreate('key', () => source)
      expect(map.get('key')).toBe(source)
    })
  })

  describe('weak references', () => {
    it('recreates the source once the previous value is garbage collected', async () => {
      const map = new SourceMap<number>()
      const key = phash('a')

      map.getOrCreate(key, () => makeSource())
      expect(map.get(key)).not.toBeUndefined()

      Bun.gc(true)
      await new Promise(resolve => setTimeout(resolve, 0))
      Bun.gc(true)

      expect(map.get(key)).toBeUndefined()

      const replacement = makeSource()
      const factory = mock(() => replacement)
      const result = map.getOrCreate(key, factory)
      expect(result).toBe(replacement)
      expect(factory).toHaveBeenCalledTimes(1)
    })

    it('get returns undefined when WeakRef is collected but key still exists', async () => {
      const map = new SourceMap<number>()
      const key = phash('gc-test')

      // Create a source that will be garbage collected
      map.getOrCreate(key, () => makeSource())

      // Force garbage collection
      Bun.gc(true)
      await new Promise(resolve => setTimeout(resolve, 0))
      Bun.gc(true)

      // The key still exists in the map, but WeakRef.deref() returns undefined
      const result = map.get(key)
      expect(result).toBeUndefined()
    })
  })

  describe('edge cases', () => {
    it('handles numeric hash keys', () => {
      const map = new SourceMap<string>()
      const source = makeSource<string>()
      const key = phash('test')
      expect(typeof key).toBe('number')
      map.getOrCreate(key, () => source)
      expect(map.get(key)).toBe(source)
    })

    it('different keys do not interfere with each other', () => {
      const map = new SourceMap<number>()
      const key1 = phash('first')
      const key2 = phash('second')
      const key3 = phash('third')

      const source1 = makeSource()
      const source2 = makeSource()
      const source3 = makeSource()

      map.getOrCreate(key1, () => source1)
      map.getOrCreate(key2, () => source2)
      map.getOrCreate(key3, () => source3)

      expect(map.get(key1)).toBe(source1)
      expect(map.get(key2)).toBe(source2)
      expect(map.get(key3)).toBe(source3)
    })

    it('factory function is only called once per unique key', () => {
      const map = new SourceMap<number>()
      const key = phash('once')
      const factory = mock(() => makeSource())

      map.getOrCreate(key, factory)
      map.getOrCreate(key, factory)
      map.getOrCreate(key, factory)

      expect(factory).toHaveBeenCalledTimes(1)
    })
  })
})
