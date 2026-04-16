// Copied from https://github.com/urql-graphql/urql/blob/887cb2a161e22597803652e60df93b98a485dc8d/packages/core/src/utils/hash.test.ts

import { expect, it } from 'bun:test'

import { HashValue, phash } from './hash'

it('hashes given strings', () => {
  expect(phash('hello')).toMatchInlineSnapshot('261238937')
})

it('hashes given strings and seeds', () => {
  let hash: HashValue
  expect((hash = phash('hello'))).toMatchInlineSnapshot('261238937')
  expect((hash = phash('world', hash))).toMatchInlineSnapshot('-152191')
  expect((hash = phash('!', hash))).toMatchInlineSnapshot('-5022270')
  expect(typeof hash).toBe('number')
})
