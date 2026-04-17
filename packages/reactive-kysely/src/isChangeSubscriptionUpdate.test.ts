import { describe, expect, it } from 'bun:test'

import type { Primitive } from '@repliql/utils'

import {
  MATCH_ALL,
  type ChangeSubscription,
  initChangeSubscription,
  matchAll,
  matchAllTable,
  matchTable,
  selectAll,
  selectTable,
} from './ChangeSubscription'
import { compileChangeSubscription, isChangeSubscriptionUpdate } from './isChangeSubscriptionUpdate'
import { RowUpdate } from './types'

interface Users {
  id: number
  name: string
  age: number
  data: {
    foo: number
    bar: number
    nested?: { x: number; y: number }
    deep?: { level2: { level3: { leaf: number; label: string } } }
  } | null
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
  sub: ChangeSubscription<DB>
  update: RowUpdate<DB>
  result: boolean
}

const subAllAll: ChangeSubscription<DB> = matchAll(selectAll(initChangeSubscription<DB>()))

const subIdEq1: ChangeSubscription<DB> = matchTable(
  selectTable(initChangeSubscription<DB>(), 'users', { id: true, name: true }),
  'users',
  { id: { $in: [1] } },
)

const subIdNin1: ChangeSubscription<DB> = matchTable(
  selectTable(initChangeSubscription<DB>(), 'users', { id: true, name: true }),
  'users',
  { id: { $nin: [1] } },
)

const subFooNin42: ChangeSubscription<DB> = matchTable(
  selectAll(initChangeSubscription<DB>()),
  'users',
  { data: { foo: { $nin: [42] } } },
)

const subJsonField: ChangeSubscription<DB> = matchAllTable(
  selectTable(initChangeSubscription<DB>(), 'users', { data: { foo: true } }),
  'users',
)

const subValuesObject: ChangeSubscription<DB> = matchTable(
  selectAll(initChangeSubscription<DB>()),
  'users',
  { data: { $in: [{ foo: 1, bar: 2 }] as unknown as Primitive[] } },
)

const subFieldsPredicate: ChangeSubscription<DB> = matchTable(
  selectAll(initChangeSubscription<DB>()),
  'users',
  { data: { foo: { $in: [42] } } },
)

const subNoMatchers: ChangeSubscription<DB> = selectAll(initChangeSubscription<DB>())

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
    it: 'insert with wide sub → true',
    sub: subAllAll,
    update: { table: 'users', oldRow: null, newRow: user() },
    result: true,
  },
  {
    it: 'delete with wide sub → true',
    sub: subAllAll,
    update: { table: 'users', oldRow: user(), newRow: null },
    result: true,
  },
  {
    it: 'identical-row update with wide sub → false',
    sub: subAllAll,
    update: { table: 'users', oldRow: user(), newRow: user() },
    result: false,
  },
  {
    it: 'column-changing update with wide sub → true',
    sub: subAllAll,
    update: { table: 'users', oldRow: user(), newRow: user({ name: 'b' }) },
    result: true,
  },
  {
    it: 'both rows null → false',
    sub: subAllAll,
    update: { table: 'users', oldRow: null, newRow: null },
    result: false,
  },

  // ---- narrow value matcher + narrow selection ----
  {
    it: 'update on unrelated table → false',
    sub: subIdEq1,
    update: {
      table: 'posts',
      oldRow: { id: 1, user_id: 1, title: 't' },
      newRow: { id: 1, user_id: 1, title: 'u' },
    },
    result: false,
  },
  {
    it: 'neither row has matching id → false',
    sub: subIdEq1,
    update: {
      table: 'users',
      oldRow: user({ id: 2 }),
      newRow: user({ id: 2, name: 'b' }),
    },
    result: false,
  },
  {
    it: 'id transitions out of matched set → true',
    sub: subIdEq1,
    update: { table: 'users', oldRow: user({ id: 1 }), newRow: user({ id: 2 }) },
    result: true,
  },
  {
    it: 'matched row, only unselected column changes → false',
    sub: subIdEq1,
    update: {
      table: 'users',
      oldRow: user({ id: 1, age: 1 }),
      newRow: user({ id: 1, age: 99 }),
    },
    result: false,
  },
  {
    it: 'matched row, selected column changes → true',
    sub: subIdEq1,
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
    sub: subJsonField,
    update: {
      table: 'users',
      oldRow: user({ data: { foo: 1, bar: 1 } }),
      newRow: user({ data: { foo: 1, bar: 2 } }),
    },
    result: false,
  },
  {
    it: 'selected field within column changes → true',
    sub: subJsonField,
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
    sub: subValuesObject,
    update: { table: 'users', oldRow: null, newRow: user({ data: { bar: 2, foo: 1 } }) },
    result: true,
  },
  {
    it: 'non-equal object value does not match',
    sub: subValuesObject,
    update: { table: 'users', oldRow: null, newRow: user({ data: { foo: 1, bar: 3 } }) },
    result: false,
  },

  // ---- fields matcher (JSON column field predicate) ----
  {
    it: 'targeted field has matching value',
    sub: subFieldsPredicate,
    update: { table: 'users', oldRow: null, newRow: user({ data: { foo: 42, bar: 0 } }) },
    result: true,
  },
  {
    it: 'targeted field has non-matching value',
    sub: subFieldsPredicate,
    update: { table: 'users', oldRow: null, newRow: user({ data: { foo: 7, bar: 0 } }) },
    result: false,
  },

  // ---- empty matchers ----
  {
    it: 'empty filter never fires',
    sub: subNoMatchers,
    update: { table: 'users', oldRow: null, newRow: user() },
    result: false,
  },

  // ---- ChangeSubscription-specific: OR semantics across filter entries ----
  {
    it: 'second filter entry matches → true',
    sub: matchTable(
      matchTable(selectAll(initChangeSubscription<DB>()), 'users', { id: { $in: [1] } }),
      'users',
      { id: { $in: [2] } },
    ),
    update: { table: 'users', oldRow: null, newRow: user({ id: 2 }) },
    result: true,
  },
  {
    it: 'neither filter entry matches → false',
    sub: matchTable(
      matchTable(selectAll(initChangeSubscription<DB>()), 'users', { id: { $in: [1] } }),
      'users',
      { id: { $in: [2] } },
    ),
    update: { table: 'users', oldRow: null, newRow: user({ id: 3 }) },
    result: false,
  },

  // ---- JSON field-level filter predicates ----
  {
    it: 'data.foo field-predicate, transition into matched set → true',
    sub: subFieldsPredicate,
    update: {
      table: 'users',
      oldRow: user({ data: { foo: 7, bar: 0 } }),
      newRow: user({ data: { foo: 42, bar: 0 } }),
    },
    result: true,
  },
  {
    it: 'data.foo field-predicate + narrow selection on data.foo, unrelated field changes → false',
    sub: matchTable(
      selectTable(initChangeSubscription<DB>(), 'users', { data: { foo: true } }),
      'users',
      { data: { foo: { $in: [42] } } },
    ),
    update: {
      table: 'users',
      oldRow: user({ data: { foo: 42, bar: 1 } }),
      newRow: user({ data: { foo: 42, bar: 2 } }),
    },
    result: false,
  },
  {
    it: 'data: null → { foo: 42 } under data.foo field predicate → true',
    sub: subFieldsPredicate,
    update: {
      table: 'users',
      oldRow: user({ data: null }),
      newRow: user({ data: { foo: 42, bar: 0 } }),
    },
    result: true,
  },
  {
    it: 'data: { foo: 42 } → null under data.foo field predicate → true',
    sub: subFieldsPredicate,
    update: {
      table: 'users',
      oldRow: user({ data: { foo: 42, bar: 0 } }),
      newRow: user({ data: null }),
    },
    result: true,
  },
  {
    it: 'MATCH_ALL field predicate matches any non-null data',
    sub: matchTable(selectAll(initChangeSubscription<DB>()), 'users', {
      data: { foo: MATCH_ALL },
    }),
    update: {
      table: 'users',
      oldRow: user({ data: { foo: 1, bar: 1 } }),
      newRow: user({ data: { foo: 2, bar: 1 } }),
    },
    result: true,
  },
  {
    it: 'two-field predicate requires both to match — both match → true',
    sub: matchTable(selectAll(initChangeSubscription<DB>()), 'users', {
      data: { foo: { $in: [1] }, bar: { $in: [2] } },
    }),
    update: {
      table: 'users',
      oldRow: null,
      newRow: user({ data: { foo: 1, bar: 2 } }),
    },
    result: true,
  },
  {
    it: 'two-field predicate requires both to match — only one matches → false',
    sub: matchTable(selectAll(initChangeSubscription<DB>()), 'users', {
      data: { foo: { $in: [1] }, bar: { $in: [2] } },
    }),
    update: {
      table: 'users',
      oldRow: null,
      newRow: user({ data: { foo: 1, bar: 9 } }),
    },
    result: false,
  },

  // ---- $nin column predicate ----
  {
    it: '$nin filter: row with excluded value → false',
    sub: subIdNin1,
    update: {
      table: 'users',
      oldRow: user({ id: 1, name: 'a' }),
      newRow: user({ id: 1, name: 'b' }),
    },
    result: false,
  },
  {
    it: '$nin filter: both rows outside excluded set, selected col changes → true',
    sub: subIdNin1,
    update: {
      table: 'users',
      oldRow: user({ id: 2, name: 'a' }),
      newRow: user({ id: 2, name: 'b' }),
    },
    result: true,
  },
  {
    it: '$nin filter: transition into excluded set (was visible, now hidden) → true',
    sub: subIdNin1,
    update: { table: 'users', oldRow: user({ id: 2 }), newRow: user({ id: 1 }) },
    result: true,
  },
  {
    it: '$nin filter: transition out of excluded set (was hidden, now visible) → true',
    sub: subIdNin1,
    update: { table: 'users', oldRow: user({ id: 1 }), newRow: user({ id: 2 }) },
    result: true,
  },
  {
    it: '$nin filter: outside excluded set, only unselected column changes → false',
    sub: subIdNin1,
    update: {
      table: 'users',
      oldRow: user({ id: 2, age: 1 }),
      newRow: user({ id: 2, age: 99 }),
    },
    result: false,
  },

  // ---- $nin on JSON field ----
  {
    it: '$nin JSON field: foo 42→43 (into matched set) → true',
    sub: subFooNin42,
    update: {
      table: 'users',
      oldRow: user({ data: { foo: 42, bar: 0 } }),
      newRow: user({ data: { foo: 43, bar: 0 } }),
    },
    result: true,
  },
  {
    it: '$nin JSON field: foo 42→42 (stays excluded) → false',
    sub: subFooNin42,
    update: {
      table: 'users',
      oldRow: user({ data: { foo: 42, bar: 0 } }),
      newRow: user({ data: { foo: 42, bar: 1 } }),
    },
    result: false,
  },
  {
    it: '$nin JSON field: foo 7→8 (both outside set, bar also changes) → true',
    sub: subFooNin42,
    update: {
      table: 'users',
      oldRow: user({ data: { foo: 7, bar: 0 } }),
      newRow: user({ data: { foo: 8, bar: 0 } }),
    },
    result: true,
  },

  // ---- combined $in + $nin on same column ----
  {
    it: '$in+$nin combined: matches whitelist AND not in blacklist → true',
    sub: matchTable(selectAll(initChangeSubscription<DB>()), 'users', {
      data: { foo: { $in: [1] }, bar: { $nin: [2] } },
    }),
    update: {
      table: 'users',
      oldRow: null,
      newRow: user({ data: { foo: 1, bar: 3 } }),
    },
    result: true,
  },
  {
    it: '$in+$nin combined: matches whitelist but IS in blacklist → false',
    sub: matchTable(selectAll(initChangeSubscription<DB>()), 'users', {
      data: { foo: { $in: [1] }, bar: { $nin: [2] } },
    }),
    update: {
      table: 'users',
      oldRow: null,
      newRow: user({ data: { foo: 1, bar: 2 } }),
    },
    result: false,
  },

  // ---- 2-level nested field matchers ----
  {
    it: '2-level $in: subfield matches → true',
    sub: matchTable(selectAll(initChangeSubscription<DB>()), 'users', {
      data: { nested: { x: { $in: [1] } } },
    }),
    update: {
      table: 'users',
      oldRow: null,
      newRow: user({ data: { foo: 0, bar: 0, nested: { x: 1, y: 9 } } }),
    },
    result: true,
  },
  {
    it: '2-level $in: subfield does not match → false',
    sub: matchTable(selectAll(initChangeSubscription<DB>()), 'users', {
      data: { nested: { x: { $in: [1] } } },
    }),
    update: {
      table: 'users',
      oldRow: null,
      newRow: user({ data: { foo: 0, bar: 0, nested: { x: 2, y: 9 } } }),
    },
    result: false,
  },
  {
    it: '2-level $in: parent field is missing/null → false',
    sub: matchTable(selectAll(initChangeSubscription<DB>()), 'users', {
      data: { nested: { x: { $in: [1] } } },
    }),
    update: {
      table: 'users',
      oldRow: null,
      newRow: user({ data: { foo: 0, bar: 0 } }),
    },
    result: false,
  },
  {
    it: '2-level $nin: excluded subfield → false',
    sub: matchTable(selectAll(initChangeSubscription<DB>()), 'users', {
      data: { nested: { x: { $nin: [1] } } },
    }),
    update: {
      table: 'users',
      oldRow: null,
      newRow: user({ data: { foo: 0, bar: 0, nested: { x: 1, y: 9 } } }),
    },
    result: false,
  },
  {
    it: '2-level $nin: allowed subfield → true',
    sub: matchTable(selectAll(initChangeSubscription<DB>()), 'users', {
      data: { nested: { x: { $nin: [1] } } },
    }),
    update: {
      table: 'users',
      oldRow: null,
      newRow: user({ data: { foo: 0, bar: 0, nested: { x: 2, y: 9 } } }),
    },
    result: true,
  },
  {
    it: '2-level MATCH_ALL on subfield: subfield present on new row → true',
    sub: matchTable(selectAll(initChangeSubscription<DB>()), 'users', {
      data: { nested: { x: MATCH_ALL } },
    }),
    update: {
      table: 'users',
      oldRow: null,
      newRow: user({ data: { foo: 0, bar: 0, nested: { x: 5, y: 9 } } }),
    },
    result: true,
  },
  {
    it: '2-level mixed predicate: first-level $in AND second-level $in (both match) → true',
    sub: matchTable(selectAll(initChangeSubscription<DB>()), 'users', {
      data: { foo: { $in: [1] }, nested: { x: { $in: [10] } } },
    }),
    update: {
      table: 'users',
      oldRow: null,
      newRow: user({ data: { foo: 1, bar: 0, nested: { x: 10, y: 9 } } }),
    },
    result: true,
  },
  {
    it: '2-level mixed predicate: first-level matches but second-level fails → false',
    sub: matchTable(selectAll(initChangeSubscription<DB>()), 'users', {
      data: { foo: { $in: [1] }, nested: { x: { $in: [10] } } },
    }),
    update: {
      table: 'users',
      oldRow: null,
      newRow: user({ data: { foo: 1, bar: 0, nested: { x: 99, y: 9 } } }),
    },
    result: false,
  },

  // ---- 3-level nested field matchers ----
  {
    it: '3-level $in: deepest leaf matches → true',
    sub: matchTable(selectAll(initChangeSubscription<DB>()), 'users', {
      data: { deep: { level2: { level3: { leaf: { $in: [7] } } } } },
    }),
    update: {
      table: 'users',
      oldRow: null,
      newRow: user({
        data: {
          foo: 0,
          bar: 0,
          deep: { level2: { level3: { leaf: 7, label: 'x' } } },
        },
      }),
    },
    result: true,
  },
  {
    it: '3-level $in: deepest leaf does not match → false',
    sub: matchTable(selectAll(initChangeSubscription<DB>()), 'users', {
      data: { deep: { level2: { level3: { leaf: { $in: [7] } } } } },
    }),
    update: {
      table: 'users',
      oldRow: null,
      newRow: user({
        data: {
          foo: 0,
          bar: 0,
          deep: { level2: { level3: { leaf: 8, label: 'x' } } },
        },
      }),
    },
    result: false,
  },
  {
    it: '3-level $nin: excluded leaf → false',
    sub: matchTable(selectAll(initChangeSubscription<DB>()), 'users', {
      data: { deep: { level2: { level3: { leaf: { $nin: [7] } } } } },
    }),
    update: {
      table: 'users',
      oldRow: null,
      newRow: user({
        data: {
          foo: 0,
          bar: 0,
          deep: { level2: { level3: { leaf: 7, label: 'x' } } },
        },
      }),
    },
    result: false,
  },
  {
    it: '3-level: intermediate field missing → false',
    sub: matchTable(selectAll(initChangeSubscription<DB>()), 'users', {
      data: { deep: { level2: { level3: { leaf: { $in: [7] } } } } },
    }),
    update: {
      table: 'users',
      oldRow: null,
      newRow: user({ data: { foo: 0, bar: 0 } }),
    },
    result: false,
  },
  {
    it: '3-level: sibling leaf change under same depth still matches filter and selection differs → true',
    sub: matchTable(selectAll(initChangeSubscription<DB>()), 'users', {
      data: { deep: { level2: { level3: { leaf: MATCH_ALL } } } },
    }),
    update: {
      table: 'users',
      oldRow: user({
        data: {
          foo: 0,
          bar: 0,
          deep: { level2: { level3: { leaf: 7, label: 'a' } } },
        },
      }),
      newRow: user({
        data: {
          foo: 0,
          bar: 0,
          deep: { level2: { level3: { leaf: 7, label: 'b' } } },
        },
      }),
    },
    result: true,
  },

  // ---- MATCH_ALL column predicate + narrow selection ----
  {
    it: 'MATCH_ALL column filter + narrow selection, non-selected column change → false',
    sub: matchTable(selectTable(initChangeSubscription<DB>(), 'users', { name: true }), 'users', {
      id: MATCH_ALL,
    }),
    update: {
      table: 'users',
      oldRow: user({ id: 1, age: 1 }),
      newRow: user({ id: 1, age: 2 }),
    },
    result: false,
  },
  {
    it: 'MATCH_ALL column filter + narrow selection, selected column change → true',
    sub: matchTable(selectTable(initChangeSubscription<DB>(), 'users', { name: true }), 'users', {
      id: MATCH_ALL,
    }),
    update: {
      table: 'users',
      oldRow: user({ id: 1, name: 'a' }),
      newRow: user({ id: 1, name: 'b' }),
    },
    result: true,
  },
]

describe('isChangeSubscriptionUpdate', () => {
  for (const t of tests) {
    it(t.it, () => {
      expect(isChangeSubscriptionUpdate<DB>(compileChangeSubscription(t.sub), t.update)).toBe(
        t.result,
      )
    })
  }
})
