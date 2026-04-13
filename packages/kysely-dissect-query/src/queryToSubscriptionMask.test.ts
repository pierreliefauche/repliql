import { describe, expect, it } from 'bun:test'

import {
  DummyDriver,
  Kysely,
  type OperationNodeSource,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  sql,
  type SqlBool,
} from 'kysely'

import { queryToSubscriptionMask, type QueryMask } from './queryToSubscriptionMask'

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
    createIntrospector: d => new PostgresIntrospector(d),
    createQueryCompiler: () => new PostgresQueryCompiler(),
  },
})

type TestCase = {
  it: string
  query: OperationNodeSource
  result: QueryMask<DB>
}

const tests: TestCase[] = [
  // ---- selection basics ----
  {
    it: 'basic selectAll()',
    query: db.selectFrom('users').selectAll(),
    result: {
      operation: 'select',
      select: { type: 'narrow', tables: { users: { type: 'all' } } },
      matchers: [{ type: 'narrow', table: 'users', match: { type: 'all' } }],
    },
  },
  {
    it: 'select specific columns (unqualified, single table)',
    query: db.selectFrom('users').select(['id', 'name']),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: {
          users: {
            type: 'narrow',
            columns: { id: { type: 'all' }, name: { type: 'all' } },
          },
        },
      },
      matchers: [{ type: 'narrow', table: 'users', match: { type: 'all' } }],
    },
  },
  {
    it: 'qualified columns',
    query: db.selectFrom('users').select('users.id'),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: {
          users: { type: 'narrow', columns: { id: { type: 'all' } } },
        },
      },
      matchers: [{ type: 'narrow', table: 'users', match: { type: 'all' } }],
    },
  },
  {
    it: 'single table, unqualified columns with > operator',
    query: db.selectFrom('users').select(['id', 'name']).where('age', '>', 18),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: {
          users: {
            type: 'narrow',
            columns: { id: { type: 'all' }, name: { type: 'all' } },
          },
        },
      },
      matchers: [
        {
          type: 'narrow',
          table: 'users',
          match: {
            type: 'narrow',
            columns: { age: { type: 'all' } },
          },
        },
      ],
    },
  },
  {
    it: 'multiple tables with inner join',
    query: db
      .selectFrom('users')
      .innerJoin('posts', 'posts.user_id', 'users.id')
      .select(['users.id', 'posts.title']),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: {
          users: { type: 'narrow', columns: { id: { type: 'all' } } },
          posts: { type: 'narrow', columns: { title: { type: 'all' } } },
        },
      },
      matchers: [
        {
          type: 'narrow',
          table: 'users',
          match: { type: 'all' },
        },
        {
          type: 'narrow',
          table: 'posts',
          match: { type: 'all' },
        },
      ],
    },
  },
  {
    it: 'left join — table appears, ON columns skipped',
    query: db.selectFrom('users').leftJoin('posts', 'posts.user_id', 'users.id').select('users.id'),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: {
          users: { type: 'narrow', columns: { id: { type: 'all' } } },
        },
      },
      matchers: [
        {
          type: 'narrow',
          table: 'users',
          match: { type: 'all' },
        },
      ],
    },
  },
  {
    it: 'left join with unknown column in WHERE → matcher widened to all',
    query: db
      .selectFrom('users')
      .leftJoin('posts', 'posts.user_id', 'users.id')
      .select('users.id')
      .where('age', '=', 34),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: {
          users: { type: 'narrow', columns: { id: { type: 'all' } } },
        },
      },
      matchers: [
        {
          type: 'narrow',
          table: 'users',
          match: {
            type: 'narrow',
            columns: { age: { type: 'values', values: [34] } },
          },
        },
        {
          type: 'narrow',
          table: 'posts',
          match: {
            type: 'narrow',
            columns: { age: { type: 'values', values: [34] } },
          },
        },
      ],
    },
  },
  {
    it: 'left join — select all',
    query: db.selectFrom('users').leftJoin('posts', 'posts.user_id', 'users.id').selectAll(),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: {
          users: { type: 'all' },
          posts: { type: 'all' },
        },
      },
      matchers: [
        {
          type: 'narrow',
          table: 'users',
          match: { type: 'all' },
        },
        {
          type: 'narrow',
          table: 'posts',
          match: { type: 'all' },
        },
      ],
    },
  },
  // ---- WHERE operators ----
  {
    it: 'WHERE with = operator',
    query: db.selectFrom('users').select('id').where('name', '=', 'John'),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: { users: { type: 'narrow', columns: { id: { type: 'all' } } } },
      },
      matchers: [
        {
          type: 'narrow',
          table: 'users',
          match: {
            type: 'narrow',
            columns: { name: { type: 'values', values: ['John'] } },
          },
        },
      ],
    },
  },
  {
    it: 'WHERE with in operator',
    query: db.selectFrom('users').select('id').where('name', 'in', ['Alice', 'Bob']),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: { users: { type: 'narrow', columns: { id: { type: 'all' } } } },
      },
      matchers: [
        {
          type: 'narrow',
          table: 'users',
          match: {
            type: 'narrow',
            columns: { name: { type: 'values', values: ['Alice', 'Bob'] } },
          },
        },
      ],
    },
  },
  {
    it: 'WHERE with > operator → column type all',
    query: db.selectFrom('users').select('id').where('age', '>', 18),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: { users: { type: 'narrow', columns: { id: { type: 'all' } } } },
      },
      matchers: [
        {
          type: 'narrow',
          table: 'users',
          match: {
            type: 'narrow',
            columns: { age: { type: 'all' } },
          },
        },
      ],
    },
  },
  {
    it: 'WHERE with is operator → column type all',
    query: db.selectFrom('users').select('id').where('deleted', 'is', null),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: { users: { type: 'narrow', columns: { id: { type: 'all' } } } },
      },
      matchers: [
        {
          type: 'narrow',
          table: 'users',
          match: {
            type: 'narrow',
            columns: { deleted: { type: 'all' } },
          },
        },
      ],
    },
  },
  {
    it: 'multiple WHERE (AND) — merged into one narrow matcher',
    query: db.selectFrom('users').select('id').where('name', '=', 'John').where('age', '>', 18),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: { users: { type: 'narrow', columns: { id: { type: 'all' } } } },
      },
      matchers: [
        {
          type: 'narrow',
          table: 'users',
          match: {
            type: 'narrow',
            columns: {
              name: { type: 'values', values: ['John'] },
              age: { type: 'all' },
            },
          },
        },
      ],
    },
  },
  {
    it: 'multiple = on same column via AND — values accumulate',
    query: db
      .selectFrom('users')
      .select('id')
      .where('name', '=', 'John')
      .where('name', '=', 'Jane'),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: { users: { type: 'narrow', columns: { id: { type: 'all' } } } },
      },
      matchers: [
        {
          type: 'narrow',
          table: 'users',
          match: {
            type: 'narrow',
            columns: { name: { type: 'values', values: ['John', 'Jane'] } },
          },
        },
      ],
    },
  },
  {
    it: 'unqualified column in multi-table query → matcher widened to all',
    query: db
      .selectFrom('users')
      .innerJoin('posts', 'posts.user_id', 'users.id')
      .select(['users.id', 'posts.title'])
      .where('age', '>', 18),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: {
          users: { type: 'narrow', columns: { id: { type: 'all' } } },
          posts: { type: 'narrow', columns: { title: { type: 'all' } } },
        },
      },
      matchers: [
        {
          type: 'narrow',
          table: 'users',
          match: {
            type: 'narrow',
            columns: { age: { type: 'all' } },
          },
        },
        {
          type: 'narrow',
          table: 'posts',
          match: {
            type: 'narrow',
            columns: { age: { type: 'all' } },
          },
        },
      ],
    },
  },
  {
    it: 'column alias — select(users.id as uid)',
    query: db.selectFrom('users').select('users.id as uid'),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: {
          users: { type: 'narrow', columns: { id: { type: 'all' } } },
        },
      },
      matchers: [{ type: 'narrow', table: 'users', match: { type: 'all' } }],
    },
  },
  {
    it: 'table alias — selectFrom(users as u).select(u.id)',
    query: db.selectFrom('users as u').select('u.id'),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: {
          users: { type: 'narrow', columns: { id: { type: 'all' } } },
        },
      },
      matchers: [{ type: 'narrow', table: 'users', match: { type: 'all' } }],
    },
  },
  {
    it: 'table alias in WHERE',
    query: db.selectFrom('users as u').select('u.id').where('u.name', '=', 'John'),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: {
          users: { type: 'narrow', columns: { id: { type: 'all' } } },
        },
      },
      matchers: [
        {
          type: 'narrow',
          table: 'users',
          match: {
            type: 'narrow',
            columns: { name: { type: 'values', values: ['John'] } },
          },
        },
      ],
    },
  },
  {
    it: 'selectAll(users) on inner join — users columns widened; posts still produces a matcher',
    query: db
      .selectFrom('users')
      .innerJoin('posts', 'posts.user_id', 'users.id')
      .selectAll('users'),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: {
          users: { type: 'all' },
        },
      },
      matchers: [
        { type: 'narrow', table: 'users', match: { type: 'all' } },
        { type: 'narrow', table: 'posts', match: { type: 'all' } },
      ],
    },
  },
  {
    it: 'bare selectAll() with multiple tables — widen all',
    query: db.selectFrom('users').innerJoin('posts', 'posts.user_id', 'users.id').selectAll(),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: {
          users: { type: 'all' },
          posts: { type: 'all' },
        },
      },
      matchers: [
        {
          type: 'narrow',
          table: 'users',
          match: { type: 'all' },
        },
        {
          type: 'narrow',
          table: 'posts',
          match: { type: 'all' },
        },
      ],
    },
  },
  {
    it: 'WHERE subquery — column widened to all, table+column scope preserved',
    query: db
      .selectFrom('users')
      .select('users.id')
      .where('users.id', 'in', db.selectFrom('posts').select('posts.user_id')),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: { users: { type: 'narrow', columns: { id: { type: 'all' } } } },
      },
      matchers: [
        {
          type: 'narrow',
          table: 'users',
          match: {
            type: 'narrow',
            columns: { id: { type: 'all' } },
          },
        },
        {
          type: 'narrow',
          table: 'posts',
          match: {
            type: 'narrow',
            columns: { user_id: { type: 'all' } },
          },
        },
      ],
    },
  },
  {
    it: 'README-like combined example',
    query: db
      .selectFrom('users')
      .innerJoin('posts', 'posts.user_id', 'users.id')
      .select(['users.id', 'posts.title'])
      .where('age', '>', 18)
      .where('users.name', '=', 'John')
      .where('posts.tag', 'in', ['news', 'archive']),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: {
          users: { type: 'narrow', columns: { id: { type: 'all' } } },
          posts: { type: 'narrow', columns: { title: { type: 'all' } } },
        },
      },
      matchers: [
        {
          type: 'narrow',
          table: 'users',
          match: {
            type: 'narrow',
            columns: {
              age: { type: 'all' },
              name: { type: 'values', values: ['John'] },
            },
          },
        },
        {
          type: 'narrow',
          table: 'posts',
          match: {
            type: 'narrow',
            columns: {
              age: { type: 'all' },
              tag: { type: 'values', values: ['news', 'archive'] },
            },
          },
        },
      ],
    },
  },
  {
    it: 'select with multiple froms',
    query: db.selectFrom(['users', 'posts']).select(['users.id', 'posts.title']),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: {
          users: { type: 'narrow', columns: { id: { type: 'all' } } },
          posts: { type: 'narrow', columns: { title: { type: 'all' } } },
        },
      },
      matchers: [
        {
          type: 'narrow',
          table: 'users',
          match: { type: 'all' },
        },
        {
          type: 'narrow',
          table: 'posts',
          match: { type: 'all' },
        },
      ],
    },
  },
  {
    it: 'column both selected and filtered with =',
    query: db.selectFrom('users').select('name').where('name', '=', 'John'),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: { users: { type: 'narrow', columns: { name: { type: 'all' } } } },
      },
      matchers: [
        {
          type: 'narrow',
          table: 'users',
          match: {
            type: 'narrow',
            columns: { name: { type: 'values', values: ['John'] } },
          },
        },
      ],
    },
  },
  {
    it: 'column both selected and filtered with unknown operator',
    query: db.selectFrom('users').select('age').where('age', '>', 18),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: { users: { type: 'narrow', columns: { age: { type: 'all' } } } },
      },
      matchers: [
        {
          type: 'narrow',
          table: 'users',
          match: {
            type: 'narrow',
            columns: { age: { type: 'all' } },
          },
        },
      ],
    },
  },
  // ---- OR / DNF ----
  {
    it: 'OR of two eq predicates → two matchers',
    query: db
      .selectFrom('users')
      .select('id')
      .where(eb => eb.or([eb('name', '=', 'John'), eb('name', '=', 'Jane')])),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: { users: { type: 'narrow', columns: { id: { type: 'all' } } } },
      },
      matchers: [
        {
          type: 'narrow',
          table: 'users',
          match: {
            type: 'narrow',
            columns: { name: { type: 'values', values: ['John'] } },
          },
        },
        {
          type: 'narrow',
          table: 'users',
          match: {
            type: 'narrow',
            columns: { name: { type: 'values', values: ['Jane'] } },
          },
        },
      ],
    },
  },
  {
    it: '(a=1 AND b=2) OR c=3 → two matchers',
    query: db
      .selectFrom('users')
      .select('id')
      .where(eb =>
        eb.or([eb.and([eb('name', '=', 'John'), eb('age', '=', 30)]), eb('deleted', '=', true)]),
      ),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: { users: { type: 'narrow', columns: { id: { type: 'all' } } } },
      },
      matchers: [
        {
          type: 'narrow',
          table: 'users',
          match: {
            type: 'narrow',
            columns: {
              name: { type: 'values', values: ['John'] },
              age: { type: 'values', values: [30] },
            },
          },
        },
        {
          type: 'narrow',
          table: 'users',
          match: {
            type: 'narrow',
            columns: { deleted: { type: 'values', values: [true] } },
          },
        },
      ],
    },
  },
  // ---- writes ----
  {
    it: 'insert query',
    query: db.insertInto('users').values({ id: 1, name: 'John', age: 30, deleted: false }),
    result: { operation: 'insert', table: 'users' },
  },
  {
    it: 'update query',
    query: db.updateTable('users').set({ name: 'Jane' }).where('id', '=', 1),
    result: { operation: 'update', table: 'users' },
  },
  {
    it: 'delete query',
    query: db.deleteFrom('users').where('id', '=', 1),
    result: { operation: 'delete', table: 'users' },
  },
  // ---- raw SQL ----
  {
    it: 'raw sql in SELECT → selection widened to all',
    query: db
      .selectFrom('users')
      .select(['users.id', sql<string>`concat(first_name, ' ', last_name)`.as('full_name')]),
    result: {
      operation: 'select',
      select: { type: 'all' },
      matchers: [{ type: 'narrow', table: 'users', match: { type: 'all' } }],
    },
  },
  {
    it: 'raw sql left operand in WHERE → matcher widened to all',
    query: db
      .selectFrom('users')
      .select('id')
      .where(sql`lower(name)`, '=', 'john'),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: { users: { type: 'narrow', columns: { id: { type: 'all' } } } },
      },
      matchers: [{ type: 'narrow', table: 'users', match: { type: 'all' } }],
    },
  },
  {
    it: 'raw sql as full WHERE expression → matcher all',
    query: db
      .selectFrom('users')
      .select('id')
      .where(sql<SqlBool>`name ILIKE '%john%'`),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: { users: { type: 'narrow', columns: { id: { type: 'all' } } } },
      },
      matchers: [{ type: 'narrow', table: 'users', match: { type: 'all' } }],
    },
  },
  {
    it: 'raw sql on right side of = → column type all',
    query: db
      .selectFrom('users')
      .select('id')
      .where('name', '=', sql<string>`lower('JOHN')`),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: { users: { type: 'narrow', columns: { id: { type: 'all' } } } },
      },
      matchers: [
        {
          type: 'narrow',
          table: 'users',
          match: {
            type: 'narrow',
            columns: { name: { type: 'all' } },
          },
        },
      ],
    },
  },
  {
    it: 'raw sql on right side of in → column type all',
    query: db
      .selectFrom('users')
      .select('id')
      .where('name', 'in', sql<string>`(select name from admins)`),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: { users: { type: 'narrow', columns: { id: { type: 'all' } } } },
      },
      matchers: [
        {
          type: 'narrow',
          table: 'users',
          match: {
            type: 'narrow',
            columns: { name: { type: 'all' } },
          },
        },
      ],
    },
  },
  {
    it: 'regular columns alongside raw sql in SELECT → selection all',
    query: db
      .selectFrom('users')
      .select(['users.id', 'users.name', sql<number>`extract(year from created_at)`.as('year')]),
    result: {
      operation: 'select',
      select: { type: 'all' },
      matchers: [{ type: 'narrow', table: 'users', match: { type: 'all' } }],
    },
  },
  {
    it: 'raw sql in WHERE mixed with eq filter → matcher all (AND identity keeps narrow branch)',
    query: db
      .selectFrom('users')
      .select('id')
      .where('name', '=', 'John')
      .where(sql<SqlBool>`age > 18`),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: { users: { type: 'narrow', columns: { id: { type: 'all' } } } },
      },
      matchers: [
        {
          type: 'narrow',
          table: 'users',
          match: {
            type: 'narrow',
            columns: { name: { type: 'values', values: ['John'] } },
          },
        },
      ],
    },
  },
  // ---- HAVING ----
  {
    it: 'HAVING present → matchers include {type:all}',
    query: db.selectFrom('users').select('age').groupBy('age').having('age', '=', 25),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: { users: { type: 'narrow', columns: { age: { type: 'all' } } } },
      },
      matchers: [{ type: 'narrow', table: 'users', match: { type: 'all' } }],
    },
  },
  {
    it: 'WHERE + HAVING — WHERE narrow matcher kept, extra all matcher added',
    query: db
      .selectFrom('users')
      .select('age')
      .where('name', '=', 'John')
      .groupBy('age')
      .having('age', '>', 18),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: { users: { type: 'narrow', columns: { age: { type: 'all' } } } },
      },
      matchers: [
        {
          type: 'narrow',
          table: 'users',
          match: {
            type: 'narrow',
            columns: { name: { type: 'values', values: ['John'] } },
          },
        },
        {
          type: 'narrow',
          table: 'users',
          match: { type: 'all' },
        },
      ],
    },
  },
  {
    it: 'HAVING without GROUP BY',
    query: db.selectFrom('users').selectAll().having('deleted', '=', false),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: { users: { type: 'all' } },
      },
      matchers: [{ type: 'narrow', table: 'users', match: { type: 'all' } }],
    },
  },
  {
    it: 'HAVING in multi-table query with join',
    query: db
      .selectFrom('users')
      .innerJoin('posts', 'posts.user_id', 'users.id')
      .select(['users.name', 'posts.tag'])
      .groupBy(['users.name', 'posts.tag'])
      .having('posts.tag', '=', 'featured'),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: {
          users: { type: 'narrow', columns: { name: { type: 'all' } } },
          posts: { type: 'narrow', columns: { tag: { type: 'all' } } },
        },
      },
      matchers: [
        {
          type: 'narrow',
          table: 'users',
          match: { type: 'all' },
        },
        {
          type: 'narrow',
          table: 'posts',
          match: { type: 'all' },
        },
      ],
    },
  },
  {
    it: 'AND of two = on same column is a contradiction, not a union, but is treated as a union',
    query: db
      .selectFrom('users')
      .select('id')
      .where('name', '=', 'John')
      .where('name', '=', 'Jane'),
    // Semantically the predicate is unsatisfiable. We still treat it as a union
    // which is "limited" over-matching (that's ok).
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: { users: { type: 'narrow', columns: { id: { type: 'all' } } } },
      },
      matchers: [
        {
          type: 'narrow',
          table: 'users',
          match: {
            type: 'narrow',
            columns: { name: { type: 'values', values: ['John', 'Jane'] } },
          },
        },
      ],
    },
  },
]

// Tests below encode intended/ideal behavior for known gaps. They may fail
// against the current implementation; that's expected — they pin the design
// decisions until the code catches up.
const pendingTests: TestCase[] = [
  // ---- point 2: non-literal members inside an IN list ----
  // REVIEW: FIX IT
  {
    it: 'IN list with a non-literal element → column widened to all',
    query: db
      .selectFrom('users')
      .select('id')
      .where(eb => eb('name', 'in', [sql<string>`lower('JOHN')`, 'Bob'])),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: { users: { type: 'narrow', columns: { id: { type: 'all' } } } },
      },
      matchers: [
        {
          type: 'narrow',
          table: 'users',
          match: {
            type: 'narrow',
            columns: { name: { type: 'all' } },
          },
        },
      ],
    },
  },
  // ---- point 3: dedup must not depend on column key insertion order ----
  {
    it: 'OR of two AND branches with same columns in different order should dedup',
    query: db
      .selectFrom('users')
      .select('id')
      .where(eb =>
        eb.or([
          eb.and([eb('name', '=', 'John'), eb('age', '=', 30)]),
          eb.and([eb('age', '=', 30), eb('name', '=', 'John')]),
        ]),
      ),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: { users: { type: 'narrow', columns: { id: { type: 'all' } } } },
      },
      matchers: [
        {
          type: 'narrow',
          table: 'users',
          match: {
            type: 'narrow',
            columns: {
              name: { type: 'values', values: ['John'] },
              age: { type: 'values', values: [30] },
            },
          },
        },
      ],
    },
  },
  // ---- point 5: joined-but-unselected table should still produce a matcher ----
  // REVIEW: FIX IT (i don't think it applies to left join though, for example.)
  {
    it: 'inner join where joined table is not selected still produces a matcher',
    query: db
      .selectFrom('users')
      .innerJoin('posts', 'posts.user_id', 'users.id')
      .select('users.id'),
    // `posts` rows can add/remove result rows via the join even though no
    // column is projected, so the subscription should include a posts matcher.
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: {
          users: { type: 'narrow', columns: { id: { type: 'all' } } },
        },
      },
      matchers: [
        { type: 'narrow', table: 'users', match: { type: 'all' } },
        { type: 'narrow', table: 'posts', match: { type: 'all' } },
      ],
    },
  },
  // ---- point 6: coverage gaps ----
  // REVIEW: FIX IT
  {
    it: 'NOT predicate over an equality → column widened to all',
    query: db
      .selectFrom('users')
      .select('id')
      .where(eb => eb.not(eb('name', '=', 'John'))),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: { users: { type: 'narrow', columns: { id: { type: 'all' } } } },
      },
      matchers: [
        {
          type: 'narrow',
          table: 'users',
          match: {
            type: 'narrow',
            columns: { name: { type: 'all' } },
          },
        },
      ],
    },
  },
  // REVIEW: FIX IT
  {
    it: 'subquery used as a table in FROM propagates inner tables',
    query: db.selectFrom(eb => eb.selectFrom('users').select('users.id').as('u')).select('u.id'),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: {
          users: { type: 'narrow', columns: { id: { type: 'all' } } },
        },
      },
      matchers: [{ type: 'narrow', table: 'users', match: { type: 'all' } }],
    },
  },
  // REVIEW: FIX IT
  {
    it: 'CTE (WITH) — referenced base tables propagate to the outer mask',
    query: db
      .with('active_users', d =>
        d.selectFrom('users').select('users.id').where('deleted', '=', false),
      )
      .selectFrom('active_users')
      .select('id'),
    result: {
      operation: 'select',
      select: {
        type: 'narrow',
        tables: {
          users: { type: 'narrow', columns: { id: { type: 'all' } } },
        },
      },
      matchers: [
        {
          type: 'narrow',
          table: 'users',
          match: {
            type: 'narrow',
            columns: { deleted: { type: 'values', values: [false] } },
          },
        },
      ],
    },
  },
]

describe('queryToSubscriptionMask', () => {
  for (const t of tests) {
    it(t.it, () => {
      expect(queryToSubscriptionMask<DB>(t.query)).toEqual(t.result)
    })
  }
})

describe('queryToSubscriptionMask (pending / known gaps)', () => {
  for (const t of pendingTests) {
    it(t.it, () => {
      expect(queryToSubscriptionMask<DB>(t.query)).toEqual(t.result)
    })
  }
})
