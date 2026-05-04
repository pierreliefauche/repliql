import { describe, expect, it } from 'bun:test'

import type {
  PluginTransformQueryArgs,
  PluginTransformResultArgs,
  QueryResult,
  RootOperationNode,
  UnknownRow,
} from 'kysely'

import {
  PreserveJsonNullsPlugin,
  preserveJsonNulls,
  toJsonbPreserveNulls,
} from './PreserveJsonNullsPlugin'

const NULL_SENTINEL = '$null$'

const makeQueryArgs = (node: RootOperationNode): PluginTransformQueryArgs =>
  ({ node, queryId: { queryId: 'q' } }) as unknown as PluginTransformQueryArgs

const makeResultArgs = (result: QueryResult<UnknownRow>): PluginTransformResultArgs =>
  ({ result, queryId: { queryId: 'q' } }) as unknown as PluginTransformResultArgs

async function transformRows(
  plugin: PreserveJsonNullsPlugin,
  rows: UnknownRow[],
): Promise<UnknownRow[]> {
  const out = await plugin.transformResult(makeResultArgs({ rows }))
  return out.rows
}

describe('PreserveJsonNullsPlugin', () => {
  describe('transformQuery', () => {
    it('returns the input node unchanged (noop)', () => {
      const plugin = new PreserveJsonNullsPlugin()
      const node = { kind: 'SelectQueryNode' } as unknown as RootOperationNode
      expect(plugin.transformQuery(makeQueryArgs(node))).toBe(node)
    })
  })

  describe('transformResult', () => {
    it('replaces a top-level sentinel string with null', async () => {
      const plugin = new PreserveJsonNullsPlugin()
      const rows = await transformRows(plugin, [{ id: 1, value: NULL_SENTINEL }])
      expect(rows).toEqual([{ id: 1, value: null }])
    })

    it('recurses into nested plain objects', async () => {
      const plugin = new PreserveJsonNullsPlugin()
      const rows = await transformRows(plugin, [{ data: { a: NULL_SENTINEL, b: 2 } }])
      expect(rows).toEqual([{ data: { a: null, b: 2 } }])
    })

    it('recurses into arrays', async () => {
      const plugin = new PreserveJsonNullsPlugin()
      const rows = await transformRows(plugin, [{ values: [1, NULL_SENTINEL, 3] }])
      expect(rows).toEqual([{ values: [1, null, 3] }])
    })

    it('handles deeply nested structures with arrays of objects', async () => {
      const plugin = new PreserveJsonNullsPlugin()
      const rows = await transformRows(plugin, [
        { data: { items: [{ x: NULL_SENTINEL }, { x: 'ok' }] } },
      ])
      expect(rows).toEqual([{ data: { items: [{ x: null }, { x: 'ok' }] } }])
    })

    it('leaves non-sentinel values unchanged', async () => {
      const plugin = new PreserveJsonNullsPlugin()
      const input: UnknownRow = {
        id: 1,
        s: 'hello',
        n: 42,
        b: true,
        nil: null,
        arr: [1, 2],
        obj: { k: 'v' },
      }
      const rows = await transformRows(plugin, [input])
      expect(rows).toEqual([
        { id: 1, s: 'hello', n: 42, b: true, nil: null, arr: [1, 2], obj: { k: 'v' } },
      ])
    })

    it('does not treat similar strings as sentinels', async () => {
      const plugin = new PreserveJsonNullsPlugin()
      const rows = await transformRows(plugin, [
        {
          almost: '{"$null$": true}', // extra space
          containing: 'prefix ' + NULL_SENTINEL,
          variant: '{"$null$":false}',
        },
      ])
      expect(rows).toEqual([
        {
          almost: '{"$null$": true}',
          containing: 'prefix ' + NULL_SENTINEL,
          variant: '{"$null$":false}',
        },
      ])
    })

    it('does not recurse into non-plain objects', async () => {
      const plugin = new PreserveJsonNullsPlugin()
      const date = new Date('2024-01-01T00:00:00Z')
      const rows = await transformRows(plugin, [{ createdAt: date as unknown as string }])
      expect(rows[0]!.createdAt).toBe(date)
    })

    it('preserves other result properties', async () => {
      const plugin = new PreserveJsonNullsPlugin()
      const result: QueryResult<UnknownRow> = {
        rows: [{ a: NULL_SENTINEL }],
        numAffectedRows: 3n,
        numChangedRows: 2n,
      }
      const out = await plugin.transformResult(makeResultArgs(result))
      expect(out.rows).toEqual([{ a: null }])
      expect(out.numAffectedRows).toBe(3n)
      expect(out.numChangedRows).toBe(2n)
    })

    it('returns empty rows unchanged', async () => {
      const plugin = new PreserveJsonNullsPlugin()
      expect(await transformRows(plugin, [])).toEqual([])
    })

    it('handles multiple rows independently', async () => {
      const plugin = new PreserveJsonNullsPlugin()
      const rows = await transformRows(plugin, [
        { x: NULL_SENTINEL },
        { x: 'real' },
        { x: NULL_SENTINEL },
      ])
      expect(rows).toEqual([{ x: null }, { x: 'real' }, { x: null }])
    })
  })
})

describe('preserveJsonNulls', () => {
  it('replaces a top-level null with the sentinel string', () => {
    expect(preserveJsonNulls(null as unknown)).toBe(NULL_SENTINEL)
  })

  it('returns non-null primitives unchanged', () => {
    expect(preserveJsonNulls(42)).toBe(42)
    expect(preserveJsonNulls('hi')).toBe('hi')
    expect(preserveJsonNulls(true)).toBe(true)
    expect(preserveJsonNulls(undefined)).toBe(undefined)
  })

  it('replaces null values inside objects with the sentinel string', () => {
    const input: Record<string, unknown> = { a: null, b: 2 }
    expect(preserveJsonNulls(input)).toEqual({ a: NULL_SENTINEL, b: 2 })
  })

  it('replaces null values inside arrays with the sentinel string', () => {
    const input: unknown[] = [1, null, 3]
    expect(preserveJsonNulls(input)).toEqual([1, NULL_SENTINEL, 3])
  })

  it('handles deeply nested nulls', () => {
    expect(preserveJsonNulls({ data: { items: [{ x: null }, { x: 'ok' }] } })).toEqual({
      data: { items: [{ x: NULL_SENTINEL }, { x: 'ok' }] },
    })
  })

  it('leaves non-null values unchanged (does not touch existing sentinel strings)', () => {
    expect(preserveJsonNulls({ a: NULL_SENTINEL, b: 'x' })).toEqual({ a: NULL_SENTINEL, b: 'x' })
  })

  it('mutates plain object inputs in place', () => {
    const input: { a: unknown } = { a: null }
    const result = preserveJsonNulls(input)
    expect(result).toBe(input)
    expect(input.a).toBe(NULL_SENTINEL)
  })

  it('returns a new array (map) for array inputs', () => {
    const input: unknown[] = [1, null]
    const result = preserveJsonNulls(input)
    expect(result).not.toBe(input)
    expect(result).toEqual([1, NULL_SENTINEL])
  })

  it('round-trips with the plugin (nulls survive JSON serialization)', async () => {
    const original = { a: null, b: [1, null, 'x'], c: { d: null, e: 2 } }
    // Simulate the write path, JSON storage, and then the read path
    const preserved = preserveJsonNulls(structuredClone(original))
    const parsed = JSON.parse(JSON.stringify(preserved)) as Record<string, unknown>
    const plugin = new PreserveJsonNullsPlugin()
    const rows = await transformRows(plugin, [parsed])
    expect(rows[0]).toEqual(original)
  })
})

describe('toJsonbPreserveNulls', () => {
  it('JSON-stringifies non-null primitives directly', () => {
    expect(toJsonbPreserveNulls({ a: 1, b: 'x' })).toBe('{"a":1,"b":"x"}')
    expect(toJsonbPreserveNulls([1, 2, 3])).toBe('[1,2,3]')
    expect(toJsonbPreserveNulls(42)).toBe('42')
  })

  it('encodes a top-level null as the stringified sentinel', () => {
    expect(toJsonbPreserveNulls(null)).toBe(JSON.stringify(NULL_SENTINEL))
  })

  it('encodes nested nulls as stringified sentinels', () => {
    expect(toJsonbPreserveNulls({ a: null, b: 2 })).toBe(
      `{"a":${JSON.stringify(NULL_SENTINEL)},"b":2}`,
    )
    expect(toJsonbPreserveNulls([1, null])).toBe(`[1,${JSON.stringify(NULL_SENTINEL)}]`)
  })
})

describe('transform edge cases', () => {
  it('preserveJsonNulls skips inherited properties (only transforms own properties)', () => {
    const proto = { inherited: null }
    const obj = Object.create(proto) as { own: null; inherited?: unknown }
    obj.own = null

    const result = preserveJsonNulls(obj)
    expect(result.own).toBe(NULL_SENTINEL)
    // Inherited property is not transformed, it should still be null when accessed via prototype
    expect(Object.prototype.hasOwnProperty.call(result, 'inherited')).toBe(false)
  })

  it('preserveJsonNulls does not transform non-plain objects like Map', () => {
    const map = new Map([['key', null]])
    const result = preserveJsonNulls(map)
    expect(result).toBe(map)
    expect(result.get('key')).toBe(null) // unchanged
  })

  it('preserveJsonNulls does not transform RegExp objects', () => {
    const regex = /test/
    const result = preserveJsonNulls(regex)
    expect(result).toBe(regex)
  })

  it('preserveJsonNulls handles arrays containing non-plain objects', () => {
    const date = new Date('2024-01-01')
    const input: unknown[] = [null, date, { nested: null }]
    const result = preserveJsonNulls(input)

    expect(result[0]).toBe(NULL_SENTINEL)
    expect(result[1]).toBe(date) // Date object unchanged
    expect(result[2]).toEqual({ nested: NULL_SENTINEL })
  })

  it('PreserveJsonNullsPlugin handles rows with mixed special objects', async () => {
    const plugin = new PreserveJsonNullsPlugin()
    const date = new Date('2024-01-01')
    const rows = await transformRows(plugin, [
      {
        id: 1,
        createdAt: date as unknown as string,
        data: { nullField: NULL_SENTINEL, otherField: 'ok' },
        tags: [NULL_SENTINEL, 'tag1'],
      },
    ])

    expect(rows[0]!.id).toBe(1)
    expect(rows[0]!.createdAt).toBe(date)
    expect(rows[0]!.data).toEqual({ nullField: null, otherField: 'ok' })
    expect(rows[0]!.tags).toEqual([null, 'tag1'])
  })

  it('preserveJsonNulls handles empty objects', () => {
    const input = {}
    const result = preserveJsonNulls(input)
    expect(result).toBe(input)
    expect(result).toEqual({})
  })

  it('preserveJsonNulls handles empty arrays', () => {
    const input: unknown[] = []
    const result = preserveJsonNulls(input)
    expect(result).not.toBe(input) // arrays return new array via map
    expect(result).toEqual([])
  })
})
