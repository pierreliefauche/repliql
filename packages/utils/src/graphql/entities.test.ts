import { describe, it, expect } from 'bun:test'

import {
  decomposeEntityHandle,
  getEntityTypename,
  getEntityRef,
  parseEntityRef,
  getEntityPointer,
  isEntityRef,
  isEntity,
  isEntityPointer,
  isEntityHandle,
  type Entity,
  type EntityRef,
  type EntityPointer,
} from './entities'

describe('entities', () => {
  // Test fixtures
  const entity: Entity<'User'> = { __typename: 'User', id: '123', name: 'John' }
  const entityRef: EntityRef<'User'> = 'User:123'
  const entityPointer: EntityPointer<'User'> = { __ref: 'User:123' }

  describe('isEntity', () => {
    it('returns true for valid entity objects', () => {
      expect(isEntity(entity)).toBe(true)
      expect(isEntity({ __typename: 'Post', id: '456' })).toBe(true)
    })

    it('returns false for objects without __typename', () => {
      expect(isEntity({ id: '123' })).toBe(false)
    })

    it('returns false for objects without id', () => {
      expect(isEntity({ __typename: 'User' })).toBe(false)
    })

    it('returns false for objects with non-string __typename', () => {
      expect(isEntity({ __typename: 123, id: '123' })).toBe(false)
    })

    it('returns false for objects with non-string id', () => {
      expect(isEntity({ __typename: 'User', id: 123 })).toBe(false)
    })

    it('returns false for primitives and null', () => {
      expect(isEntity(null)).toBe(false)
      expect(isEntity(undefined)).toBe(false)
      expect(isEntity('string')).toBe(false)
      expect(isEntity(123)).toBe(false)
      expect(isEntity(true)).toBe(false)
    })
  })

  describe('isEntityRef', () => {
    it('returns true for valid entity ref strings', () => {
      expect(isEntityRef('User:123')).toBe(true)
      expect(isEntityRef('Post:abc-def')).toBe(true)
    })

    it('returns true for refs with colons in id', () => {
      expect(isEntityRef('User:123:456')).toBe(true)
    })

    it('returns false for strings without colon', () => {
      expect(isEntityRef('User123')).toBe(false)
    })

    it('returns false for strings with empty typename', () => {
      expect(isEntityRef(':123')).toBe(false)
    })

    it('returns false for strings with empty id', () => {
      expect(isEntityRef('User:')).toBe(false)
    })

    it('returns false for non-strings', () => {
      expect(isEntityRef(123)).toBe(false)
      expect(isEntityRef(null)).toBe(false)
      expect(isEntityRef(undefined)).toBe(false)
      expect(isEntityRef({})).toBe(false)
    })
  })

  describe('isEntityPointer', () => {
    it('returns true for valid entity pointers', () => {
      expect(isEntityPointer(entityPointer)).toBe(true)
      expect(isEntityPointer({ __ref: 'Post:456' })).toBe(true)
    })

    it('returns false for objects without __ref', () => {
      expect(isEntityPointer({ ref: 'User:123' })).toBe(false)
      expect(isEntityPointer({})).toBe(false)
    })

    it('returns false for objects with invalid __ref', () => {
      expect(isEntityPointer({ __ref: 'invalid' })).toBe(false)
      expect(isEntityPointer({ __ref: 123 })).toBe(false)
    })

    it('returns false for non-objects', () => {
      expect(isEntityPointer(null)).toBe(false)
      expect(isEntityPointer(undefined)).toBe(false)
      expect(isEntityPointer('User:123')).toBe(false)
    })
  })

  describe('isEntityHandle', () => {
    it('returns true for entities', () => {
      expect(isEntityHandle(entity)).toBe(true)
    })

    it('returns true for entity refs', () => {
      expect(isEntityHandle(entityRef)).toBe(true)
    })

    it('returns true for entity pointers', () => {
      expect(isEntityHandle(entityPointer)).toBe(true)
    })

    it('returns false for non-handles', () => {
      expect(isEntityHandle(null)).toBe(false)
      expect(isEntityHandle(undefined)).toBe(false)
      expect(isEntityHandle({})).toBe(false)
      expect(isEntityHandle('invalid')).toBe(false)
    })
  })

  describe('parseEntityRef', () => {
    it('parses valid entity ref strings', () => {
      expect(parseEntityRef('User:123')).toEqual({ __typename: 'User', id: '123' })
      expect(parseEntityRef('Post:abc')).toEqual({ __typename: 'Post', id: 'abc' })
    })

    it('handles ids with colons', () => {
      expect(parseEntityRef('User:123:456:789' as EntityRef)).toEqual({
        __typename: 'User',
        id: '123:456:789',
      })
    })

    it('returns undefined for empty typename', () => {
      expect(parseEntityRef(':123' as EntityRef)).toBeUndefined()
    })

    it('returns undefined for empty id', () => {
      expect(parseEntityRef('User:' as EntityRef)).toBeUndefined()
    })
  })

  describe('decomposeEntityHandle', () => {
    it('returns entity as-is for entity input', () => {
      expect(decomposeEntityHandle(entity)).toEqual(entity)
    })

    it('parses entity ref string to entity', () => {
      expect(decomposeEntityHandle(entityRef)).toEqual({ __typename: 'User', id: '123' })
    })

    it('parses entity pointer to entity', () => {
      expect(decomposeEntityHandle(entityPointer)).toEqual({ __typename: 'User', id: '123' })
    })

    it('returns undefined for non-handles', () => {
      expect(decomposeEntityHandle(null)).toBeUndefined()
      expect(decomposeEntityHandle(undefined)).toBeUndefined()
      expect(decomposeEntityHandle({})).toBeUndefined()
      expect(decomposeEntityHandle('invalid')).toBeUndefined()
    })
  })

  describe('getEntityTypename', () => {
    it('returns typename from entity', () => {
      expect(getEntityTypename(entity)).toBe('User')
    })

    it('returns typename from entity ref', () => {
      expect(getEntityTypename(entityRef)).toBe('User')
    })

    it('returns typename from entity pointer', () => {
      expect(getEntityTypename(entityPointer)).toBe('User')
    })
  })

  describe('getEntityRef', () => {
    it('builds ref from entity', () => {
      expect(getEntityRef(entity)).toBe('User:123')
    })

    it('returns entity ref as-is', () => {
      expect(getEntityRef(entityRef)).toBe('User:123')
    })

    it('extracts ref from entity pointer', () => {
      expect(getEntityRef(entityPointer)).toBe('User:123')
    })
  })

  describe('getEntityPointer', () => {
    it('builds pointer from entity', () => {
      expect(getEntityPointer(entity)).toEqual({ __ref: 'User:123' })
    })

    it('wraps entity ref in pointer', () => {
      expect(getEntityPointer(entityRef)).toEqual({ __ref: 'User:123' })
    })

    it('returns entity pointer as-is', () => {
      expect(getEntityPointer(entityPointer)).toEqual({ __ref: 'User:123' })
    })
  })
})
