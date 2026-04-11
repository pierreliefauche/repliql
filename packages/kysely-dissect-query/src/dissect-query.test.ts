import { describe, expect, it } from 'bun:test'

import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  sql,
  type SqlBool,
} from 'kysely'

import { dissectQuery } from './dissect-query'

interface Users {
  id: number
  name: string
  age: number
  deleted: boolean | null
}

interface Posts {
  id: number
  user_id: number
  title: string
  tag: string
}

interface Comments {
  id: number
  post_id: number
  body: string
}

interface DB {
  users: Users
  posts: Posts
  comments: Comments
}

const db = new Kysely<DB>({
  dialect: {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: db => new PostgresIntrospector(db),
    createQueryCompiler: () => new PostgresQueryCompiler(),
  },
})

describe('dissectQuery', () => {
  describe('select queries', () => {
    it('basic selectAll()', () => {
      const q = db.selectFrom('users').selectAll()
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: { unidentifiedColumn: true, columns: {} },
        },
      })
    })

    it('select specific columns (unqualified, single table)', () => {
      const q = db.selectFrom('users').select(['id', 'name'])
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: {
            columns: {
              id: { selected: true },
              name: { selected: true },
            },
          },
        },
      })
    })

    it('qualified columns', () => {
      const q = db.selectFrom('users').select('users.id')
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: {
            columns: { id: { selected: true } },
          },
        },
      })
    })

    it('single table, unqualified columns resolve to that table', () => {
      const q = db.selectFrom('users').select(['id', 'name']).where('age', '>', 18)
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: {
            columns: {
              id: { selected: true },
              name: { selected: true },
              age: { selected: false, unknownOperator: true },
            },
          },
        },
      })
    })

    it('multiple tables with inner join — ON columns NOT recorded', () => {
      const q = db
        .selectFrom('users')
        .innerJoin('posts', 'posts.user_id', 'users.id')
        .select(['users.id', 'posts.title'])
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: { columns: { id: { selected: true } } },
          posts: { columns: { title: { selected: true } } },
        },
      })
    })

    it('left join — table appears, ON columns skipped', () => {
      const q = db
        .selectFrom('users')
        .leftJoin('posts', 'posts.user_id', 'users.id')
        .select('users.id')
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: { columns: { id: { selected: true } } },
          posts: { columns: {} },
        },
      })
    })

    it('left join — table appears, ON columns skipped, unknown column', () => {
      const q = db
        .selectFrom('users')
        .leftJoin('posts', 'posts.user_id', 'users.id')
        .select('users.id')
        .where('age', '=', 34)
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: { columns: { id: { selected: true } } },
          posts: { columns: {} },
        },
        unidentifiedTable: {
          columns: {
            age: {
              eq: [34],
              selected: false,
            },
          },
        },
      })
    })

    it('left join — select all', () => {
      const q = db.selectFrom('users').leftJoin('posts', 'posts.user_id', 'users.id').selectAll()
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: { columns: {}, unidentifiedColumn: true },
          posts: { columns: {}, unidentifiedColumn: true },
        },
      })
    })

    it('WHERE with = operator', () => {
      const q = db.selectFrom('users').select('id').where('name', '=', 'John')
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: {
            columns: {
              id: { selected: true },
              name: { selected: false, eq: ['John'] },
            },
          },
        },
      })
    })

    it('WHERE with in operator', () => {
      const q = db.selectFrom('users').select('id').where('name', 'in', ['Alice', 'Bob'])
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: {
            columns: {
              id: { selected: true },
              name: { selected: false, eq: ['Alice', 'Bob'] },
            },
          },
        },
      })
    })

    it('WHERE with > operator — unknownOperator', () => {
      const q = db.selectFrom('users').select('id').where('age', '>', 18)
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: {
            columns: {
              id: { selected: true },
              age: { selected: false, unknownOperator: true },
            },
          },
        },
      })
    })

    it('WHERE with is operator — unknownOperator', () => {
      const q = db.selectFrom('users').select('id').where('deleted', 'is', null)
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: {
            columns: {
              id: { selected: true },
              deleted: { selected: false, unknownOperator: true },
            },
          },
        },
      })
    })

    it('multiple WHERE clauses (AND chain)', () => {
      const q = db.selectFrom('users').select('id').where('name', '=', 'John').where('age', '>', 18)
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: {
            columns: {
              id: { selected: true },
              name: { selected: false, eq: ['John'] },
              age: { selected: false, unknownOperator: true },
            },
          },
        },
      })
    })

    it('multiple = on same column — eq values accumulate', () => {
      const q = db
        .selectFrom('users')
        .select('id')
        .where('name', '=', 'John')
        .where('name', '=', 'Jane')
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: {
            columns: {
              id: { selected: true },
              name: { selected: false, eq: ['John', 'Jane'] },
            },
          },
        },
      })
    })

    it('unqualified column in multi-table query → unidentifiedTable', () => {
      const q = db
        .selectFrom('users')
        .innerJoin('posts', 'posts.user_id', 'users.id')
        .select(['users.id', 'posts.title'])
        .where('age', '>', 18)
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: { columns: { id: { selected: true } } },
          posts: { columns: { title: { selected: true } } },
        },
        unidentifiedTable: {
          columns: { age: { selected: false, unknownOperator: true } },
        },
      })
    })

    it('column alias — select("users.id as uid") → column is id under users', () => {
      const q = db.selectFrom('users').select('users.id as uid')
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: { columns: { id: { selected: true } } },
        },
      })
    })

    it('table alias — selectFrom("users as u").select("u.id") → under users', () => {
      const q = db.selectFrom('users as u').select('u.id')
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: { columns: { id: { selected: true } } },
        },
      })
    })

    it('table alias in WHERE', () => {
      const q = db.selectFrom('users as u').select('u.id').where('u.name', '=', 'John')
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: {
            columns: {
              id: { selected: true },
              name: { selected: false, eq: ['John'] },
            },
          },
        },
      })
    })

    it('selectAll("users") — unidentifiedColumn on users only', () => {
      const q = db
        .selectFrom('users')
        .innerJoin('posts', 'posts.user_id', 'users.id')
        .selectAll('users')
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: { unidentifiedColumn: true, columns: {} },
          posts: { columns: {} },
        },
      })
    })

    it('bare selectAll() with multiple tables — unidentifiedColumn on all', () => {
      const q = db.selectFrom('users').innerJoin('posts', 'posts.user_id', 'users.id').selectAll()
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: { unidentifiedColumn: true, columns: {} },
          posts: { unidentifiedColumn: true, columns: {} },
        },
      })
    })

    it('WHERE subquery — subquery table appears in top-level result', () => {
      const q = db
        .selectFrom('users')
        .select('users.id')
        .where('users.id', 'in', db.selectFrom('posts').select('posts.user_id'))
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: { columns: { id: { selected: true, unknownOperator: true } } },
          posts: { columns: { user_id: { selected: false } } },
        },
      })
    })

    it('WHERE subquery — subquery table appears in top-level result - variant', () => {
      const q = db
        .selectFrom('users')
        .select('users.id')
        .where('users.id', 'in', db.selectFrom('posts').select('posts.user_id'))
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: { columns: { id: { selected: true, unknownOperator: true } } },
          posts: { columns: { user_id: { selected: false } } },
        },
      })
    })

    it('README example — exact match', () => {
      const q = db
        .selectFrom('users')
        .innerJoin('posts', 'posts.user_id', 'users.id')
        .select(['users.id', 'posts.title'])
        .where('age', '>', 18)
        .where('users.name', '=', 'John')
        .where('posts.tag', 'in', ['news', 'archive'])
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: {
            columns: {
              id: { selected: true },
              name: { selected: false, eq: ['John'] },
            },
          },
          posts: {
            columns: {
              title: { selected: true },
              tag: { selected: false, eq: ['news', 'archive'] },
            },
          },
        },
        unidentifiedTable: {
          columns: { age: { selected: false, unknownOperator: true } },
        },
      })
    })

    it('select with multiple froms', () => {
      const q = db.selectFrom(['users', 'posts']).select(['users.id', 'posts.title'])
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: { columns: { id: { selected: true } } },
          posts: { columns: { title: { selected: true } } },
        },
      })
    })

    it('column both selected and filtered with =', () => {
      const q = db.selectFrom('users').select('name').where('name', '=', 'John')
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: {
            columns: { name: { selected: true, eq: ['John'] } },
          },
        },
      })
    })

    it('column both selected and filtered with unknown operator', () => {
      const q = db.selectFrom('users').select('age').where('age', '>', 18)
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: {
            columns: { age: { selected: true, unknownOperator: true } },
          },
        },
      })
    })
  })

  describe('write queries', () => {
    it('insert query', () => {
      const q = db.insertInto('users').values({ id: 1, name: 'John', age: 30, deleted: false })
      expect(dissectQuery(q)).toEqual({ operation: 'insert', table: 'users' })
    })

    it('update query', () => {
      const q = db.updateTable('users').set({ name: 'Jane' }).where('id', '=', 1)
      expect(dissectQuery(q)).toEqual({ operation: 'update', table: 'users' })
    })

    it('delete query', () => {
      const q = db.deleteFrom('users').where('id', '=', 1)
      expect(dissectQuery(q)).toEqual({ operation: 'delete', table: 'users' })
    })
  })

  describe('raw SQL', () => {
    it('raw sql in SELECT — signals unidentifiedColumn', () => {
      const q = db
        .selectFrom('users')
        .select(['users.id', sql<string>`concat(first_name, ' ', last_name)`.as('full_name')])
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: { columns: { id: { selected: true } } },
        },
        unidentifiedTable: { unidentifiedColumn: true, columns: {} },
      })
    })

    it('raw sql as left operand in WHERE — signals unidentifiedColumn', () => {
      const q = db
        .selectFrom('users')
        .select('id')
        .where(sql`lower(name)`, '=', 'john')
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: { columns: { id: { selected: true } } },
        },
        unidentifiedTable: { unidentifiedColumn: true, columns: {} },
      })
    })

    it('raw sql as full WHERE expression — signals unidentifiedColumn', () => {
      const q = db
        .selectFrom('users')
        .select('id')
        .where(sql<SqlBool>`name ILIKE '%john%'`)
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: { columns: { id: { selected: true } } },
        },
        unidentifiedTable: { unidentifiedColumn: true, columns: {} },
      })
    })

    it('raw sql on right side of = — unknownOperator since value cannot be extracted', () => {
      const q = db
        .selectFrom('users')
        .select('id')
        .where('name', '=', sql<string>`lower('JOHN')`)
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: {
            columns: {
              id: { selected: true },
              name: { selected: false, unknownOperator: true },
            },
          },
        },
      })
    })

    it('raw sql on right side of in — unknownOperator since values cannot be extracted', () => {
      const q = db
        .selectFrom('users')
        .select('id')
        .where('name', 'in', sql<string>`(select name from admins)`)
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: {
            columns: {
              id: { selected: true },
              name: { selected: false, unknownOperator: true },
            },
          },
        },
      })
    })

    it('regular columns alongside raw sql in SELECT — signals unidentifiedColumn', () => {
      const q = db
        .selectFrom('users')
        .select(['users.id', 'users.name', sql<number>`extract(year from created_at)`.as('year')])
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: {
            columns: {
              id: { selected: true },
              name: { selected: true },
            },
          },
        },
        unidentifiedTable: { unidentifiedColumn: true, columns: {} },
      })
    })

    it('raw sql in WHERE mixed with normal filters — signals unidentifiedColumn', () => {
      const q = db
        .selectFrom('users')
        .select('id')
        .where('name', '=', 'John')
        .where(sql<SqlBool>`age > 18`)
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: {
            columns: {
              id: { selected: true },
              name: { selected: false, eq: ['John'] },
            },
          },
        },
        unidentifiedTable: { unidentifiedColumn: true, columns: {} },
      })
    })
  })

  describe('HAVING clause', () => {
    it('basic HAVING with = operator', () => {
      const q = db.selectFrom('users').select('age').groupBy('age').having('age', '=', 25)
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: {
            columns: {
              age: { selected: true, eq: [25] },
            },
          },
        },
      })
    })

    it('HAVING with in operator', () => {
      const q = db
        .selectFrom('users')
        .select('age')
        .groupBy('age')
        .having('age', 'in', [18, 21, 25])
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: {
            columns: {
              age: { selected: true, eq: [18, 21, 25] },
            },
          },
        },
      })
    })

    it('HAVING with > operator — unknownOperator', () => {
      const q = db.selectFrom('users').select('age').groupBy('age').having('age', '>', 18)
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: {
            columns: {
              age: { selected: true, unknownOperator: true },
            },
          },
        },
      })
    })

    it('HAVING with < operator — unknownOperator', () => {
      const q = db.selectFrom('users').select('age').groupBy('age').having('age', '<', 65)
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: {
            columns: {
              age: { selected: true, unknownOperator: true },
            },
          },
        },
      })
    })

    it('multiple HAVING clauses with AND — eq values accumulate', () => {
      const q = db
        .selectFrom('users')
        .select('age')
        .groupBy('age')
        .having('age', '=', 25)
        .having('age', '=', 30)
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: {
            columns: {
              age: { selected: true, eq: [25, 30] },
            },
          },
        },
      })
    })

    it('HAVING with qualified column reference', () => {
      const q = db
        .selectFrom('users')
        .select('users.age')
        .groupBy('users.age')
        .having('users.age', '=', 25)
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: {
            columns: {
              age: { selected: true, eq: [25] },
            },
          },
        },
      })
    })

    it('combined WHERE and HAVING — columns merge into same result', () => {
      const q = db
        .selectFrom('users')
        .select('age')
        .where('name', '=', 'John')
        .groupBy('age')
        .having('age', '>', 18)
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: {
            columns: {
              age: { selected: true, unknownOperator: true },
              name: { selected: false, eq: ['John'] },
            },
          },
        },
      })
    })

    it('same column in WHERE and HAVING — eq and unknownOperator combine', () => {
      const q = db
        .selectFrom('users')
        .select('age')
        .where('age', '=', 25)
        .groupBy('age')
        .having('age', '>', 20)
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: {
            columns: {
              age: { selected: true, eq: [25], unknownOperator: true },
            },
          },
        },
      })
    })

    it('HAVING without WHERE clause', () => {
      const q = db.selectFrom('users').select('age').groupBy('age').having('age', '=', 25)
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: {
            columns: {
              age: { selected: true, eq: [25] },
            },
          },
        },
      })
    })

    it('HAVING without GROUP BY (valid SQL in some contexts)', () => {
      const q = db.selectFrom('users').selectAll().having('deleted', '=', false)
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: {
            unidentifiedColumn: true,
            columns: {
              deleted: { selected: false, eq: [false] },
            },
          },
        },
      })
    })

    it('HAVING in multi-table query with join', () => {
      const q = db
        .selectFrom('users')
        .innerJoin('posts', 'posts.user_id', 'users.id')
        .select(['users.name', 'posts.tag'])
        .groupBy(['users.name', 'posts.tag'])
        .having('posts.tag', '=', 'featured')
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: { columns: { name: { selected: true } } },
          posts: { columns: { tag: { selected: true, eq: ['featured'] } } },
        },
      })
    })

    it('HAVING with sql raw expression on right side — unknownOperator', () => {
      const q = db
        .selectFrom('users')
        .select('age')
        .groupBy('age')
        .having('age', '=', sql<number>`count(*) / 2`)
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: {
            columns: {
              age: { selected: true, unknownOperator: true },
            },
          },
        },
      })
    })

    it('HAVING with unqualified column in single-table query — resolves to table', () => {
      const q = db.selectFrom('users').select('age').groupBy('age').having('age', 'in', [25, 30])
      expect(dissectQuery(q)).toEqual({
        operation: 'select',
        tables: {
          users: {
            columns: {
              age: { selected: true, eq: [25, 30] },
            },
          },
        },
      })
    })
  })
})
