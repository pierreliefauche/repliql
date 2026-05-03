import { describe, it, expect } from 'bun:test'

import { GraphQLError, parse } from '@0no-co/graphql.web'

import { compile, execute } from './execute'
import type { ResolveInfo } from './execute'

describe('execute', () => {
  it('resolves a simple query', async () => {
    const doc = parse(`{ hello }`)
    const result = await execute({
      document: doc,
      context: {},
      fieldResolver: (_src, _args, _ctx, info) => {
        if (info.fieldName === 'hello') return 'world'
      },
    })
    expect(result).toEqual({ data: { hello: 'world' } })
  })

  it('resolves nested selection and lists of objects', async () => {
    const doc = parse(`{
      users {
        id
        name
      }
    }`)
    const users = [
      { id: '1', name: 'A' },
      { id: '2', name: 'B' },
    ]
    const result = await execute({
      document: doc,
      context: {},
      fieldResolver: (src, _args, _ctx, info) => {
        if (info.fieldName === 'users') return users
        return (src as Record<string, unknown>)[info.fieldName]
      },
    })
    expect(result).toEqual({
      data: {
        users: [
          { id: '1', name: 'A' },
          { id: '2', name: 'B' },
        ],
      },
    })
  })

  it('honors aliases and merges same-key selections', async () => {
    const doc = parse(`{
      a: hello
      b: hello
      user { id }
      user { name }
    }`)
    const result = await execute({
      document: doc,
      context: {},
      fieldResolver: (src, _args, _ctx, info) => {
        if (info.fieldName === 'hello') return info.alias
        if (info.fieldName === 'user') return { id: '1', name: 'Ada' }
        return (src as Record<string, unknown>)[info.fieldName]
      },
    })
    expect(result).toEqual({
      data: { a: 'a', b: 'b', user: { id: '1', name: 'Ada' } },
    })
  })

  it('coerces variables and default values', async () => {
    const doc = parse(`query Q($x: Int, $y: Int = 5) {
      a: echo(v: $x)
      b: echo(v: $y)
    }`)
    const result = await execute({
      document: doc,
      context: {},
      variableValues: { x: 10 },
      fieldResolver: (_src, args) => args.v,
    })
    expect(result).toEqual({ data: { a: 10, b: 5 } })
  })

  it('applies @skip and @include directives', async () => {
    const doc = parse(`query Q($cond: Boolean!) {
      a: hello @skip(if: $cond)
      b: hello @include(if: $cond)
    }`)
    const r1 = await execute({
      document: doc,
      context: {},
      variableValues: { cond: true },
      fieldResolver: () => 'x',
    })
    expect(r1).toEqual({ data: { b: 'x' } })

    const r2 = await execute({
      document: doc,
      context: {},
      variableValues: { cond: false },
      fieldResolver: () => 'x',
    })
    expect(r2).toEqual({ data: { a: 'x' } })
  })

  it('resolves named fragments and inline fragments', async () => {
    const doc = parse(`
      query {
        user {
          ...UserFields
          ... on User { extra }
        }
      }
      fragment UserFields on User {
        id
        name
      }
    `)
    const result = await execute({
      document: doc,
      context: {},
      fieldResolver: (src, _args, _ctx, info) => {
        if (info.fieldName === 'user') return { id: '1', name: 'Ada', extra: 'e' }
        return (src as Record<string, unknown>)[info.fieldName]
      },
    })
    expect(result).toEqual({
      data: { user: { id: '1', name: 'Ada', extra: 'e' } },
    })
  })

  it('enters inline fragments regardless of type condition (no schema)', async () => {
    // Without a schema, inline fragment typeConditions are not filtered.
    // Every branch is merged in; the resolver is responsible for discrimination
    // (e.g. via __typename) and may return null/undefined for non-applicable fields.
    const doc = parse(`{
      node {
        __typename
        ... on User { name }
        ... on Post { title }
      }
    }`)
    const result = await execute({
      document: doc,
      context: {},
      fieldResolver: (src, _args, _ctx, info) => {
        if (info.fieldName === 'node') return { __typename: 'User', name: 'Ada' }
        return (src as Record<string, unknown>)[info.fieldName] ?? null
      },
    })
    // `title` is selected and resolved to null because the resolver doesn't
    // provide it — the executor did not skip the `... on Post` branch.
    expect(result).toEqual({
      data: { node: { __typename: 'User', name: 'Ada', title: null } },
    })
  })

  it('merges sibling inline fragments selecting the same field on different types', async () => {
    // Both branches contribute selections for `id`, which get merged into one
    // resolver call — same as same-key field merging at the top level.
    const doc = parse(`{
      node {
        ... on User { id }
        ... on Post { id }
      }
    }`)
    let idCalls = 0
    const result = await execute({
      document: doc,
      context: {},
      fieldResolver: (_src, _args, _ctx, info) => {
        if (info.fieldName === 'node') return { id: '1' }
        if (info.fieldName === 'id') {
          idCalls++
          return '1'
        }
      },
    })
    expect(result).toEqual({ data: { node: { id: '1' } } })
    expect(idCalls).toBe(1)
  })

  it('reports resolver errors without aborting siblings', async () => {
    const doc = parse(`{
      ok
      bad
      nested { inner }
    }`)
    const result = await execute({
      document: doc,
      context: {},
      fieldResolver: (_src, _args, _ctx, info) => {
        if (info.fieldName === 'ok') return 1
        if (info.fieldName === 'bad') throw new Error('boom')
        if (info.fieldName === 'nested') return {}
        if (info.fieldName === 'inner') return 'here'
      },
    })
    expect(result.data).toEqual({ ok: 1, bad: null, nested: { inner: 'here' } })
    expect(result.errors?.length).toBe(1)
    const err = result.errors![0]
    expect(err).toBeInstanceOf(GraphQLError)
    expect(err.message).toBe('boom')
    expect(err.path).toEqual(['bad'])
    expect(err.originalError?.message).toBe('boom')
  })

  it('surfaces the root operation flag', async () => {
    const doc = parse(`mutation { doIt }`)
    let seenInfo: ResolveInfo | undefined
    await execute({
      document: doc,
      context: {},
      fieldResolver: (_src, _args, _ctx, info) => {
        seenInfo = info
        return true
      },
    })
    expect(seenInfo?.rootOperation).toBe('mutation')
  })

  it('batches sibling resolvers in the same tick (DataLoader-friendly)', async () => {
    const doc = parse(`{
      a: item(id: 1)
      b: item(id: 2)
      c: item(id: 3)
    }`)
    let batchCalls = 0
    const pending: Array<{ id: number; resolve: (v: unknown) => void }> = []

    function scheduleFlush() {
      queueMicrotask(() => {
        if (!pending.length) return
        batchCalls++
        const batch = pending.splice(0)
        for (const p of batch) p.resolve(`v${p.id}`)
      })
    }

    const load = (id: number) =>
      new Promise(resolve => {
        if (!pending.length) scheduleFlush()
        pending.push({ id, resolve })
      })

    const result = await execute({
      document: doc,
      context: {},
      fieldResolver: (_src, args, _ctx, info) => {
        if (info.fieldName === 'item') return load(args.id)
      },
    })
    expect(result).toEqual({ data: { a: 'v1', b: 'v2', c: 'v3' } })
    expect(batchCalls).toBe(1)
  })

  it('runs top-level mutation fields serially', async () => {
    const doc = parse(`mutation {
      first
      second
    }`)
    const log: string[] = []
    await execute({
      document: doc,
      context: {},
      fieldResolver: async (_src, _args, _ctx, info) => {
        log.push(`start:${info.fieldName}`)
        await new Promise(r => setTimeout(r, 0))
        log.push(`end:${info.fieldName}`)
        return info.fieldName
      },
    })
    expect(log).toEqual(['start:first', 'end:first', 'start:second', 'end:second'])
  })

  it('runs top-level query fields in parallel', async () => {
    const doc = parse(`{ first second }`)
    const log: string[] = []
    await execute({
      document: doc,
      context: {},
      fieldResolver: async (_src, _args, _ctx, info) => {
        log.push(`start:${info.fieldName}`)
        await new Promise(r => setTimeout(r, 0))
        log.push(`end:${info.fieldName}`)
        return info.fieldName
      },
    })
    expect(log).toEqual(['start:first', 'start:second', 'end:first', 'end:second'])
  })

  it('fails hard when a required variable is missing', async () => {
    const doc = parse(`query Q($x: Int!) { echo(v: $x) }`)
    const result = await execute({
      document: doc,
      context: {},
      fieldResolver: () => 1,
    })
    expect(result.data).toBeUndefined()
    expect(result.errors?.length).toBe(1)
    expect(result.errors![0].message).toMatch(/\$x/)
  })

  describe('compile + execute(compiled)', () => {
    it('accepts a pre-compiled operation', async () => {
      const doc = parse(`query Q($x: Int!) { echo(v: $x) }`)
      const compiled = compile(doc)
      const result = await execute({
        compiled,
        context: {},
        variableValues: { x: 42 },
        fieldResolver: (_src, args) => args.v,
      })
      expect(result).toEqual({ data: { echo: 42 } })
    })

    it('reuses a single compiled operation across many executions', async () => {
      const doc = parse(`query Q($x: Int!) { echo(v: $x) }`)
      const compiled = compile(doc)
      const results = await Promise.all(
        [1, 2, 3].map(x =>
          execute({
            compiled,
            context: {},
            variableValues: { x },
            fieldResolver: (_src, args) => args.v,
          }),
        ),
      )
      expect(results.map(r => r.data)).toEqual([{ echo: 1 }, { echo: 2 }, { echo: 3 }])
    })

    it('flattens fragments at compile time (no FragmentSpread at runtime)', () => {
      const doc = parse(`
        query { user { ...UserFields } }
        fragment UserFields on User { id name }
      `)
      const compiled = compile(doc)
      const hasSpread = (set: {
        selections: readonly { kind: string; selectionSet?: any }[]
      }): boolean =>
        set.selections.some(s => {
          if (s.kind === 'FragmentSpread') return true
          if (s.selectionSet) return hasSpread(s.selectionSet)
          return false
        })
      expect(hasSpread(compiled.selectionSet)).toBe(false)
    })

    it('throws synchronously on missing/ambiguous operation', () => {
      const multi = parse(`query A { a } query B { b }`)
      expect(() => compile(multi)).toThrow(GraphQLError)

      expect(() => compile(multi, 'Missing')).toThrow(GraphQLError)
    })

    it('throws synchronously on unknown fragment or fragment cycle', () => {
      const unknownFrag = parse(`{ user { ...UserFields } }`)
      expect(() => compile(unknownFrag)).toThrow(/Unknown fragment/)

      const cycle = parse(`
        { user { ...A } }
        fragment A on User { ...B }
        fragment B on User { ...A }
      `)
      expect(() => compile(cycle)).toThrow(/within itself/)
    })

    it('rejects subscriptions at compile time', () => {
      const sub = parse(`subscription { changes }`)
      expect(() => compile(sub)).toThrow(/Subscriptions/)
    })

    it('selectionSet identity stays stable across executions (cacheable)', async () => {
      const doc = parse(`{ hello }`)
      const compiled = compile(doc)
      const before = compiled.selectionSet
      await execute({ compiled, context: {}, fieldResolver: () => 'x' })
      await execute({ compiled, context: {}, fieldResolver: () => 'y' })
      expect(compiled.selectionSet).toBe(before)
    })
  })

  it('selects operation by operationName and errors on ambiguity', async () => {
    const doc = parse(`
      query A { a }
      query B { b }
    `)
    const pickA = await execute({
      document: doc,
      context: {},
      operationName: 'A',
      fieldResolver: (_s, _a, _c, info) => info.fieldName,
    })
    expect(pickA).toEqual({ data: { a: 'a' } })

    const ambiguous = await execute({
      document: doc,
      context: {},
      fieldResolver: () => 1,
    })
    expect(ambiguous.errors?.length).toBe(1)
  })
})
