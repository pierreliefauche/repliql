import { describe, expect, it } from 'bun:test'

import { isPrimitive } from './primitives'

describe('isPrimitive', () => {
  it.each([
    ['string', 'hello'],
    ['empty string', ''],
    ['number', 42],
    ['zero', 0],
    ['true', true],
    ['false', false],
    ['null', null],
    ['undefined', undefined],
  ])('returns true for %s', (_label, value) => {
    expect(isPrimitive(value)).toBe(true)
  })

  it.each([
    ['object', {}],
    ['array', [1, 2, 3]],
    ['function', () => {}],
    ['NaN', Number.NaN],
    ['Infinity', Infinity],
    ['-Infinity', -Infinity],
    ['Date', new Date()],
    ['Map', new Map()],
    ['Set', new Set()],
    ['symbol', Symbol('s')],
    ['bigint', 1n],
  ])('returns false for %s', (_label, value) => {
    expect(isPrimitive(value)).toBe(false)
  })
})
