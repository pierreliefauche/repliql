import { describe, expect, it } from 'bun:test'

import {
  MATCH_ALL,
  changeSubscriptionTables,
  initChangeSubscription,
  matchAll,
  matchAllTable,
  matchTable,
  selectAll,
  selectAllTable,
  selectTable,
} from './ChangeSubscription'

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

describe('initChangeSubscription', () => {
  it('creates an empty subscription', () => {
    expect(initChangeSubscription<DB>()).toEqual({
      filter: {},
      selection: {},
    })
  })

  it('returns fresh objects on each call', () => {
    const a = initChangeSubscription<DB>()
    const b = initChangeSubscription<DB>()
    expect(a).not.toBe(b)
    expect(a.filter).not.toBe(b.filter)
    expect(a.selection).not.toBe(b.selection)
  })
})

describe('selectTable', () => {
  it('adds a table selection to an empty subscription', () => {
    const sub = selectTable(initChangeSubscription<DB>(), 'users', {
      id: true,
      name: true,
    })
    expect(sub.selection).toEqual({ users: { id: true, name: true } })
  })

  it('adds selections for multiple tables independently', () => {
    let sub = initChangeSubscription<DB>()
    sub = selectTable(sub, 'users', { id: true })
    sub = selectTable(sub, 'posts', { title: true })
    expect(sub.selection).toEqual({
      users: { id: true },
      posts: { title: true },
    })
  })

  it('merges selections for the same table', () => {
    let sub = initChangeSubscription<DB>()
    sub = selectTable(sub, 'users', { id: true })
    sub = selectTable(sub, 'users', { name: true })
    expect(sub.selection).toEqual({ users: { id: true, name: true } })
  })

  it('merges JSON field selections on the same column', () => {
    let sub = initChangeSubscription<DB>()
    sub = selectTable(sub, 'users', { data: { foo: true } })
    sub = selectTable(sub, 'users', { data: { bar: true } })
    expect(sub.selection).toEqual({
      users: { data: { foo: true, bar: true } },
    })
  })

  it('prefers true over a field-level selection when merging', () => {
    let sub = initChangeSubscription<DB>()
    sub = selectTable(sub, 'users', { data: { foo: true } })
    sub = selectTable(sub, 'users', { data: true })
    expect(sub.selection).toEqual({ users: { data: true } })
  })

  it('keeps true when merging in a field-level selection', () => {
    let sub = initChangeSubscription<DB>()
    sub = selectTable(sub, 'users', { data: true })
    sub = selectTable(sub, 'users', { data: { foo: true } })
    expect(sub.selection).toEqual({ users: { data: true } })
  })

  it('no-ops when selection is already true globally', () => {
    const base = selectAll(initChangeSubscription<DB>())
    const sub = selectTable(base, 'users', { id: true })
    expect(sub).toBe(base)
  })

  it('no-ops when selection for that table is already true', () => {
    const base = selectAllTable(initChangeSubscription<DB>(), 'users')
    const sub = selectTable(base, 'users', { id: true })
    expect(sub).toBe(base)
  })

  it('does not mutate the input', () => {
    const original = initChangeSubscription<DB>()
    const originalSnapshot = structuredClone(original)
    selectTable(original, 'users', { id: true })
    expect(original).toEqual(originalSnapshot)
  })

  it('preserves filter when updating selection', () => {
    let sub = initChangeSubscription<DB>()
    sub = matchAllTable(sub, 'users')
    sub = selectTable(sub, 'posts', { title: true })
    expect(sub.filter).toEqual({ users: MATCH_ALL })
  })
})

describe('selectAllTable', () => {
  it('marks a table as fully selected', () => {
    const sub = selectAllTable(initChangeSubscription<DB>(), 'users')
    expect(sub.selection).toEqual({ users: true })
  })

  it('overwrites a prior narrow selection for that table', () => {
    let sub = initChangeSubscription<DB>()
    sub = selectTable(sub, 'users', { id: true })
    sub = selectAllTable(sub, 'users')
    expect(sub.selection).toEqual({ users: true })
  })

  it('no-ops when selection is already globally true', () => {
    const base = selectAll(initChangeSubscription<DB>())
    const sub = selectAllTable(base, 'users')
    expect(sub).toBe(base)
  })
})

describe('selectAll', () => {
  it('sets selection to true', () => {
    const sub = selectAll(initChangeSubscription<DB>())
    expect(sub.selection).toBe(true)
  })

  it('overrides a prior narrow selection', () => {
    let sub = initChangeSubscription<DB>()
    sub = selectTable(sub, 'users', { id: true })
    sub = selectAll(sub)
    expect(sub.selection).toBe(true)
  })

  it('preserves the filter', () => {
    let sub = initChangeSubscription<DB>()
    sub = matchTable(sub, 'users', { id: { $in: [1] } })
    sub = selectAll(sub)
    expect(sub.filter).toEqual({ users: [{ id: { $in: [1] } }] })
  })
})

describe('matchTable', () => {
  it('adds a filter entry to an empty subscription', () => {
    const sub = matchTable(initChangeSubscription<DB>(), 'users', {
      id: { $in: [1] },
    })
    expect(sub.filter).toEqual({ users: [{ id: { $in: [1] } }] })
  })

  it('appends new filter entries for the same table', () => {
    let sub = initChangeSubscription<DB>()
    sub = matchTable(sub, 'users', { id: { $in: [1] } })
    sub = matchTable(sub, 'users', { name: { $in: ['alice'] } })
    expect(sub.filter).toEqual({
      users: [{ id: { $in: [1] } }, { name: { $in: ['alice'] } }],
    })
  })

  it('tracks filters for different tables independently', () => {
    let sub = initChangeSubscription<DB>()
    sub = matchTable(sub, 'users', { id: { $in: [1] } })
    sub = matchTable(sub, 'posts', { title: { $in: ['hi'] } })
    expect(sub.filter).toEqual({
      users: [{ id: { $in: [1] } }],
      posts: [{ title: { $in: ['hi'] } }],
    })
  })

  it('supports MATCH_ALL as a column-level value match', () => {
    const sub = matchTable(initChangeSubscription<DB>(), 'users', {
      name: MATCH_ALL,
    })
    expect(sub.filter).toEqual({ users: [{ name: MATCH_ALL }] })
  })

  it('supports JSON field-level matches', () => {
    const sub = matchTable(initChangeSubscription<DB>(), 'users', {
      data: { foo: { $in: [1] } },
    })
    expect(sub.filter).toEqual({
      users: [{ data: { foo: { $in: [1] } } }],
    })
  })

  it('no-ops when filter is already globally MATCH_ALL', () => {
    const base = matchAll(initChangeSubscription<DB>())
    const sub = matchTable(base, 'users', { id: { $in: [1] } })
    expect(sub).toBe(base)
  })

  it('no-ops when the table filter is already MATCH_ALL', () => {
    const base = matchAllTable(initChangeSubscription<DB>(), 'users')
    const sub = matchTable(base, 'users', { id: { $in: [1] } })
    expect(sub).toBe(base)
  })

  it('does not mutate the input subscription', () => {
    const original = matchTable(initChangeSubscription<DB>(), 'users', {
      id: { $in: [1] },
    })
    const snapshot = structuredClone(original)
    matchTable(original, 'users', { id: { $in: [2] } })
    expect(original).toEqual(snapshot)
  })
})

describe('matchAllTable', () => {
  it('sets the table filter to MATCH_ALL', () => {
    const sub = matchAllTable(initChangeSubscription<DB>(), 'users')
    expect(sub.filter).toEqual({ users: MATCH_ALL })
  })

  it('overrides a prior narrow filter for that table', () => {
    let sub = initChangeSubscription<DB>()
    sub = matchTable(sub, 'users', { id: { $in: [1] } })
    sub = matchAllTable(sub, 'users')
    expect(sub.filter).toEqual({ users: MATCH_ALL })
  })

  it('leaves other tables untouched', () => {
    let sub = initChangeSubscription<DB>()
    sub = matchTable(sub, 'posts', { title: { $in: ['hi'] } })
    sub = matchAllTable(sub, 'users')
    expect(sub.filter).toEqual({
      posts: [{ title: { $in: ['hi'] } }],
      users: MATCH_ALL,
    })
  })

  it('no-ops when filter is already globally MATCH_ALL', () => {
    const base = matchAll(initChangeSubscription<DB>())
    const sub = matchAllTable(base, 'users')
    expect(sub).toBe(base)
  })
})

describe('matchAll', () => {
  it('sets filter to MATCH_ALL', () => {
    const sub = matchAll(initChangeSubscription<DB>())
    expect(sub.filter).toBe(MATCH_ALL)
  })

  it('overrides a prior narrow filter', () => {
    let sub = initChangeSubscription<DB>()
    sub = matchTable(sub, 'users', { id: { $in: [1] } })
    sub = matchAll(sub)
    expect(sub.filter).toBe(MATCH_ALL)
  })

  it('preserves the selection', () => {
    let sub = initChangeSubscription<DB>()
    sub = selectTable(sub, 'users', { id: true })
    sub = matchAll(sub)
    expect(sub.selection).toEqual({ users: { id: true } })
  })
})

describe('selectTable merging', () => {
  it('merges disjoint columns into the same table entry', () => {
    let sub = initChangeSubscription<DB>()
    sub = selectTable(sub, 'users', { id: true })
    sub = selectTable(sub, 'users', { name: true })
    sub = selectTable(sub, 'users', { age: true })
    expect(sub.selection).toEqual({
      users: { id: true, name: true, age: true },
    })
  })

  it('keeps earlier columns untouched when adding new ones', () => {
    let sub = initChangeSubscription<DB>()
    sub = selectTable(sub, 'users', { id: true, name: true })
    sub = selectTable(sub, 'users', { age: true })
    expect(sub.selection).toEqual({
      users: { id: true, name: true, age: true },
    })
  })

  it('merges JSON field selections across three calls', () => {
    let sub = initChangeSubscription<DB>()
    sub = selectTable(sub, 'users', { data: { foo: true } })
    sub = selectTable(sub, 'users', { data: { bar: true } })
    sub = selectTable(sub, 'users', { data: { foo: true } })
    expect(sub.selection).toEqual({
      users: { data: { foo: true, bar: true } },
    })
  })

  it('merges a JSON-field column alongside a simple column', () => {
    let sub = initChangeSubscription<DB>()
    sub = selectTable(sub, 'users', { data: { foo: true } })
    sub = selectTable(sub, 'users', { id: true })
    expect(sub.selection).toEqual({
      users: { data: { foo: true }, id: true },
    })
  })

  it('mixing true and field-object upgrades to true regardless of order across multiple calls', () => {
    let a = initChangeSubscription<DB>()
    a = selectTable(a, 'users', { data: { foo: true } })
    a = selectTable(a, 'users', { data: { bar: true } })
    a = selectTable(a, 'users', { data: true })

    let b = initChangeSubscription<DB>()
    b = selectTable(b, 'users', { data: true })
    b = selectTable(b, 'users', { data: { foo: true } })
    b = selectTable(b, 'users', { data: { bar: true } })

    expect(a.selection).toEqual({ users: { data: true } })
    expect(b.selection).toEqual({ users: { data: true } })
  })

  it('does not mutate the previous selection object when merging', () => {
    const first = selectTable(initChangeSubscription<DB>(), 'users', {
      id: true,
      data: { foo: true },
    })
    const snapshot = structuredClone(first)
    selectTable(first, 'users', { name: true, data: { bar: true } })
    expect(first).toEqual(snapshot)
  })

  it('does not share the merged column object with the incoming arg', () => {
    const incoming = { data: { foo: true as const } }
    let sub = selectTable(initChangeSubscription<DB>(), 'users', incoming)
    sub = selectTable(sub, 'users', { data: { bar: true } })
    expect(incoming).toEqual({ data: { foo: true } })
  })

  it('preserves selections for other tables when merging a table', () => {
    let sub = initChangeSubscription<DB>()
    sub = selectTable(sub, 'posts', { title: true })
    sub = selectTable(sub, 'users', { id: true })
    sub = selectTable(sub, 'users', { name: true })
    expect(sub.selection).toEqual({
      posts: { title: true },
      users: { id: true, name: true },
    })
  })

  it('merges with many columns at once', () => {
    let sub = initChangeSubscription<DB>()
    sub = selectTable(sub, 'users', {
      id: true,
      name: true,
      data: { foo: true },
    })
    sub = selectTable(sub, 'users', {
      age: true,
      data: { bar: true },
    })
    expect(sub.selection).toEqual({
      users: {
        id: true,
        name: true,
        age: true,
        data: { foo: true, bar: true },
      },
    })
  })
})

describe('matchTable merging', () => {
  it('appends in insertion order', () => {
    let sub = initChangeSubscription<DB>()
    sub = matchTable(sub, 'users', { id: { $in: [1] } })
    sub = matchTable(sub, 'users', { id: { $in: [2] } })
    sub = matchTable(sub, 'users', { id: { $in: [3] } })
    expect(sub.filter).toEqual({
      users: [
        { id: { $in: [1] } },
        { id: { $in: [2] } },
        { id: { $in: [3] } },
      ],
    })
  })

  it('does not dedupe identical filter entries', () => {
    let sub = initChangeSubscription<DB>()
    sub = matchTable(sub, 'users', { id: { $in: [1] } })
    sub = matchTable(sub, 'users', { id: { $in: [1] } })
    expect(sub.filter).toEqual({
      users: [{ id: { $in: [1] } }, { id: { $in: [1] } }],
    })
  })

  it('does not mutate the previous filter array when appending', () => {
    const first = matchTable(initChangeSubscription<DB>(), 'users', {
      id: { $in: [1] },
    })
    const snapshot = structuredClone(first)
    matchTable(first, 'users', { id: { $in: [2] } })
    expect(first).toEqual(snapshot)
  })

  it('does not mutate filters for untouched tables', () => {
    let sub = initChangeSubscription<DB>()
    sub = matchTable(sub, 'posts', { title: { $in: ['hi'] } })
    const postsFilter = sub.filter === MATCH_ALL ? null : sub.filter.posts
    sub = matchTable(sub, 'users', { id: { $in: [1] } })
    const postsFilterAfter = sub.filter === MATCH_ALL ? null : sub.filter.posts
    expect(postsFilter).toEqual(postsFilterAfter)
  })

  it('supports mixing specific and MATCH_ALL value matches within one filter', () => {
    const sub = matchTable(initChangeSubscription<DB>(), 'users', {
      id: { $in: [1] },
      name: MATCH_ALL,
    })
    expect(sub.filter).toEqual({
      users: [{ id: { $in: [1] }, name: MATCH_ALL }],
    })
  })

  it('interleaves appends across multiple tables', () => {
    let sub = initChangeSubscription<DB>()
    sub = matchTable(sub, 'users', { id: { $in: [1] } })
    sub = matchTable(sub, 'posts', { title: { $in: ['a'] } })
    sub = matchTable(sub, 'users', { id: { $in: [2] } })
    sub = matchTable(sub, 'posts', { title: { $in: ['b'] } })
    expect(sub.filter).toEqual({
      users: [{ id: { $in: [1] } }, { id: { $in: [2] } }],
      posts: [{ title: { $in: ['a'] } }, { title: { $in: ['b'] } }],
    })
  })

  it('matchAllTable after narrow matches discards the prior array', () => {
    let sub = initChangeSubscription<DB>()
    sub = matchTable(sub, 'users', { id: { $in: [1] } })
    sub = matchTable(sub, 'users', { id: { $in: [2] } })
    sub = matchAllTable(sub, 'users')
    expect(sub.filter).toEqual({ users: MATCH_ALL })
  })

  it('subsequent matchTable is a no-op once the table is MATCH_ALL', () => {
    let sub = initChangeSubscription<DB>()
    sub = matchAllTable(sub, 'users')
    const before = sub
    sub = matchTable(sub, 'users', { id: { $in: [1] } })
    expect(sub).toBe(before)
    expect(sub.filter).toEqual({ users: MATCH_ALL })
  })
})

describe('composition', () => {
  it('builds a realistic subscription via chained calls', () => {
    let sub = initChangeSubscription<DB>()
    sub = selectTable(sub, 'users', { id: true, name: true })
    sub = selectTable(sub, 'posts', { title: true })
    sub = matchTable(sub, 'users', { id: { $in: [1, 2] } })
    sub = matchAllTable(sub, 'posts')

    expect(sub).toEqual({
      selection: {
        users: { id: true, name: true },
        posts: { title: true },
      },
      filter: {
        users: [{ id: { $in: [1, 2] } }],
        posts: MATCH_ALL,
      },
    })
  })

  it('returns a new reference on every modifying call', () => {
    const a = initChangeSubscription<DB>()
    const b = selectTable(a, 'users', { id: true })
    const c = matchTable(b, 'users', { id: { $in: [1] } })
    expect(b).not.toBe(a)
    expect(c).not.toBe(b)
  })
})

describe('changeSubscriptionTables', () => {
  it('returns an empty array for an empty subscription', () => {
    expect(changeSubscriptionTables(initChangeSubscription<DB>())).toEqual([])
  })

  it('returns MATCH_ALL when the filter is MATCH_ALL', () => {
    const sub = matchAll(initChangeSubscription<DB>())
    expect(changeSubscriptionTables(sub)).toBe(MATCH_ALL)
  })

  it('returns MATCH_ALL when the selection is globally true', () => {
    const sub = selectAll(initChangeSubscription<DB>())
    expect(changeSubscriptionTables(sub)).toBe(MATCH_ALL)
  })

  it('returns MATCH_ALL when both filter and selection are wide', () => {
    const sub = matchAll(selectAll(initChangeSubscription<DB>()))
    expect(changeSubscriptionTables(sub)).toBe(MATCH_ALL)
  })

  it('returns tables referenced only by filter', () => {
    const sub = matchTable(initChangeSubscription<DB>(), 'users', {
      id: { $in: [1] },
    })
    expect(changeSubscriptionTables(sub)).toEqual(['users'])
  })

  it('returns tables referenced only by selection', () => {
    const sub = selectTable(initChangeSubscription<DB>(), 'posts', {
      title: true,
    })
    expect(changeSubscriptionTables(sub)).toEqual(['posts'])
  })

  it('includes tables whose filter is MATCH_ALL at the table level', () => {
    const sub = matchAllTable(initChangeSubscription<DB>(), 'users')
    expect(changeSubscriptionTables(sub)).toEqual(['users'])
  })

  it('includes tables whose selection is true at the table level', () => {
    const sub = selectAllTable(initChangeSubscription<DB>(), 'users')
    expect(changeSubscriptionTables(sub)).toEqual(['users'])
  })

  it('dedupes tables referenced by both filter and selection', () => {
    let sub = initChangeSubscription<DB>()
    sub = matchTable(sub, 'users', { id: { $in: [1] } })
    sub = selectTable(sub, 'users', { name: true })
    expect(changeSubscriptionTables(sub)).toEqual(['users'])
  })

  it('returns the union of filter and selection tables', () => {
    let sub = initChangeSubscription<DB>()
    sub = matchTable(sub, 'users', { id: { $in: [1] } })
    sub = selectTable(sub, 'posts', { title: true })
    const tables = changeSubscriptionTables(sub)
    expect(tables).not.toBe(MATCH_ALL)
    expect([...(tables as string[])].sort()).toEqual(['posts', 'users'])
  })

  it('dedupes across multiple filter entries on the same table', () => {
    let sub = initChangeSubscription<DB>()
    sub = matchTable(sub, 'users', { id: { $in: [1] } })
    sub = matchTable(sub, 'users', { id: { $in: [2] } })
    expect(changeSubscriptionTables(sub)).toEqual(['users'])
  })
})
