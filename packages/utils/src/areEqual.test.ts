import { describe, expect, it } from 'bun:test'

import { areEqual } from './areEqual'

describe('areEqual', () => {
  describe('strict equality (same reference)', () => {
    it('returns true for identical primitives', () => {
      expect(areEqual(1, 1)).toBe(true)
      expect(areEqual('hello', 'hello')).toBe(true)
      expect(areEqual(true, true)).toBe(true)
    })

    it('returns true for same object reference', () => {
      const obj = { a: 1 }
      expect(areEqual(obj, obj)).toBe(true)
    })

    it('returns true for same array reference', () => {
      const arr = [1, 2, 3]
      expect(areEqual(arr, arr)).toBe(true)
    })
  })

  describe('null and undefined equality', () => {
    it('returns true for null === null', () => {
      expect(areEqual(null, null)).toBe(true)
    })

    it('returns true for undefined === undefined', () => {
      expect(areEqual(undefined, undefined)).toBe(true)
    })

    it('returns true for null and undefined (treated as equal)', () => {
      expect(areEqual(null, undefined)).toBe(true)
      expect(areEqual(undefined, null)).toBe(true)
    })
  })

  describe('primitive comparison', () => {
    it('returns false for different primitives of same type', () => {
      expect(areEqual(1, 2)).toBe(false)
      expect(areEqual('a', 'b')).toBe(false)
      expect(areEqual(true, false)).toBe(false)
    })

    it('returns false for primitives of different types', () => {
      expect(areEqual(1, '1')).toBe(false)
      expect(areEqual(0, false)).toBe(false)
      expect(areEqual('', false)).toBe(false)
    })

    it('returns false when one is primitive and one is null/undefined', () => {
      expect(areEqual(0, null)).toBe(false)
      expect(areEqual('', null)).toBe(false)
      expect(areEqual(false, null)).toBe(false)
      expect(areEqual(0, undefined)).toBe(false)
    })
  })

  describe('object comparison (via stableStringify)', () => {
    it('returns true for objects with same properties', () => {
      expect(areEqual({ a: 1 }, { a: 1 })).toBe(true)
      expect(areEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true)
    })

    it('returns true for objects with same properties in different order', () => {
      expect(areEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
    })

    it('returns false for objects with different values', () => {
      expect(areEqual({ a: 1 }, { a: 2 })).toBe(false)
    })

    it('returns false for objects with different keys', () => {
      expect(areEqual({ a: 1 }, { b: 1 })).toBe(false)
    })

    it('returns true for nested objects with same content', () => {
      expect(areEqual({ a: { b: { c: 1 } } }, { a: { b: { c: 1 } } })).toBe(true)
    })
  })

  describe('array comparison', () => {
    it('returns true for arrays with same elements', () => {
      expect(areEqual([1, 2, 3], [1, 2, 3])).toBe(true)
    })

    it('returns false for arrays with different elements', () => {
      expect(areEqual([1, 2, 3], [1, 2, 4])).toBe(false)
    })

    it('returns false for arrays with different order', () => {
      expect(areEqual([1, 2, 3], [3, 2, 1])).toBe(false)
    })

    it('returns false for arrays with different lengths', () => {
      expect(areEqual([1, 2], [1, 2, 3])).toBe(false)
    })

    it('returns true for nested arrays with same content', () => {
      expect(
        areEqual(
          [
            [1, 2],
            [3, 4],
          ],
          [
            [1, 2],
            [3, 4],
          ],
        ),
      ).toBe(true)
    })
  })

  describe('mixed type comparison', () => {
    it('returns false when comparing primitive to object', () => {
      expect(areEqual(1, { a: 1 })).toBe(false)
      expect(areEqual('hello', { hello: true })).toBe(false)
    })

    it('returns false when comparing primitive to array', () => {
      expect(areEqual(1, [1])).toBe(false)
      expect(areEqual('a', ['a'])).toBe(false)
    })

    it('returns false when comparing object to array', () => {
      expect(areEqual({ 0: 'a' }, ['a'])).toBe(false)
    })
  })

  describe('complex nested structures', () => {
    it('returns true for deeply nested equal structures', () => {
      const a = { users: [{ name: 'Alice', tags: ['admin', 'user'] }] }
      const b = { users: [{ name: 'Alice', tags: ['admin', 'user'] }] }
      expect(areEqual(a, b)).toBe(true)
    })

    it('returns false for deeply nested different structures', () => {
      const a = { users: [{ name: 'Alice', tags: ['admin', 'user'] }] }
      const b = { users: [{ name: 'Alice', tags: ['user', 'admin'] }] }
      expect(areEqual(a, b)).toBe(false)
    })
  })
})
