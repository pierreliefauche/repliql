import { describe, expect, it } from 'bun:test'

import {
  isSubscriptionUpdate,
  type RowUpdate,
  compileSubscriptionMask,
} from './isSubscriptionUpdate'
import type { ReadQueryMask } from './queryToSubscriptionMask'

interface Users {
  id: number
  name: string
  age: number
  data: { foo: number; bar: number } | null
}

interface Posts {
  id: number
  user_id: number
  title: string
}

interface DB {
  users: Users
  posts: Posts
}

type TestCase = {
  it: string
  mask: ReadQueryMask<DB>
  update: RowUpdate<DB>
  result: boolean
}

const maskAllAll: ReadQueryMask<DB> = {
  operation: 'select',
  select: { type: 'all' },
  matchers: [{ type: 'all' }],
}

const maskIdEq1: ReadQueryMask<DB> = {
  operation: 'select',
  select: {
    type: 'narrow',
    tables: {
      users: { type: 'narrow', columns: { id: { type: 'all' }, name: { type: 'all' } } },
    },
  },
  matchers: [
    {
      type: 'narrow',
      table: 'users',
      match: { type: 'narrow', columns: { id: { type: 'values', values: [1] } } },
    },
  ],
}

const maskJsonField: ReadQueryMask<DB> = {
  operation: 'select',
  select: {
    type: 'narrow',
    tables: {
      users: {
        type: 'narrow',
        columns: { data: { type: 'narrow', fields: { foo: true } } },
      },
    },
  },
  matchers: [{ type: 'narrow', table: 'users', match: { type: 'all' } }],
}

const maskValuesObject: ReadQueryMask<DB> = {
  operation: 'select',
  select: { type: 'all' },
  matchers: [
    {
      type: 'narrow',
      table: 'users',
      match: {
        type: 'narrow',
        columns: { data: { type: 'values', values: [{ foo: 1, bar: 2 }] } },
      },
    },
  ],
}

const maskFieldsPredicate: ReadQueryMask<DB> = {
  operation: 'select',
  select: { type: 'all' },
  matchers: [
    {
      type: 'narrow',
      table: 'users',
      match: {
        type: 'narrow',
        columns: {
          data: {
            type: 'fields',
            fields: { foo: { type: 'narrow', values: [42] } },
          },
        },
      },
    },
  ],
}

const maskNoMatchers: ReadQueryMask<DB> = {
  operation: 'select',
  select: { type: 'all' },
  matchers: [],
}

const user = (over: Partial<Users> = {}): Users => ({
  id: 1,
  name: 'a',
  age: 1,
  data: null,
  ...over,
})

const tests: TestCase[] = [
  // ---- wide matcher + wide selection ----
  {
    it: 'insert with wide mask → true',
    mask: maskAllAll,
    update: { table: 'users', oldRow: null, newRow: user() },
    result: true,
  },
  {
    it: 'delete with wide mask → true',
    mask: maskAllAll,
    update: { table: 'users', oldRow: user(), newRow: null },
    result: true,
  },
  {
    it: 'identical-row update with wide mask → false',
    mask: maskAllAll,
    update: { table: 'users', oldRow: user(), newRow: user() },
    result: false,
  },
  {
    it: 'column-changing update with wide mask → true',
    mask: maskAllAll,
    update: { table: 'users', oldRow: user(), newRow: user({ name: 'b' }) },
    result: true,
  },
  {
    it: 'both rows null → false',
    mask: maskAllAll,
    update: { table: 'users', oldRow: null, newRow: null },
    result: false,
  },

  // ---- narrow value matcher + narrow selection ----
  {
    it: 'update on unrelated table → false',
    mask: maskIdEq1,
    update: {
      table: 'posts',
      oldRow: { id: 1, user_id: 1, title: 't' },
      newRow: { id: 1, user_id: 1, title: 'u' },
    },
    result: false,
  },
  {
    it: 'neither row has matching id → false',
    mask: maskIdEq1,
    update: {
      table: 'users',
      oldRow: user({ id: 2 }),
      newRow: user({ id: 2, name: 'b' }),
    },
    result: false,
  },
  {
    it: 'id transitions out of matched set → true',
    mask: maskIdEq1,
    update: { table: 'users', oldRow: user({ id: 1 }), newRow: user({ id: 2 }) },
    result: true,
  },
  {
    it: 'matched row, only unselected column changes → false',
    mask: maskIdEq1,
    update: {
      table: 'users',
      oldRow: user({ id: 1, age: 1 }),
      newRow: user({ id: 1, age: 99 }),
    },
    result: false,
  },
  {
    it: 'matched row, selected column changes → true',
    mask: maskIdEq1,
    update: {
      table: 'users',
      oldRow: user({ id: 1, name: 'a' }),
      newRow: user({ id: 1, name: 'b' }),
    },
    result: true,
  },

  // ---- JSON field-level selection ----
  {
    it: 'non-selected field within column changes → false',
    mask: maskJsonField,
    update: {
      table: 'users',
      oldRow: user({ data: { foo: 1, bar: 1 } }),
      newRow: user({ data: { foo: 1, bar: 2 } }),
    },
    result: false,
  },
  {
    it: 'selected field within column changes → true',
    mask: maskJsonField,
    update: {
      table: 'users',
      oldRow: user({ data: { foo: 1, bar: 1 } }),
      newRow: user({ data: { foo: 2, bar: 1 } }),
    },
    result: true,
  },

  // ---- values matcher with object values ----
  {
    it: 'object value matches regardless of key order',
    mask: maskValuesObject,
    update: { table: 'users', oldRow: null, newRow: user({ data: { bar: 2, foo: 1 } }) },
    result: true,
  },
  {
    it: 'non-equal object value does not match',
    mask: maskValuesObject,
    update: { table: 'users', oldRow: null, newRow: user({ data: { foo: 1, bar: 3 } }) },
    result: false,
  },

  // ---- fields matcher (JSON column field predicate) ----
  {
    it: 'targeted field has matching value',
    mask: maskFieldsPredicate,
    update: { table: 'users', oldRow: null, newRow: user({ data: { foo: 42, bar: 0 } }) },
    result: true,
  },
  {
    it: 'targeted field has non-matching value',
    mask: maskFieldsPredicate,
    update: { table: 'users', oldRow: null, newRow: user({ data: { foo: 7, bar: 0 } }) },
    result: false,
  },

  // ---- empty matchers ----
  {
    it: 'empty matchers never fire',
    mask: maskNoMatchers,
    update: { table: 'users', oldRow: null, newRow: user() },
    result: false,
  },
]

describe('isSubscriptionUpdate', () => {
  for (const t of tests) {
    it(t.it, () => {
      expect(isSubscriptionUpdate<DB>(compileSubscriptionMask(t.mask), t.update)).toBe(t.result)
    })
  }
})
