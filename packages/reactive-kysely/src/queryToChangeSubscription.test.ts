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

import { type ChangeSubscription, MATCH_ALL } from './ChangeSubscription'
import { queryToChangeSubscription } from './queryToChangeSubscription'

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
  result: ChangeSubscription<DB> | undefined
}

const tests: TestCase[] = [
  // ---- selection basics ----
  {
    it: 'basic selectAll()',
    query: db.selectFrom('users').selectAll(),
    result: {
      selection: { users: true },
      filter: { users: MATCH_ALL },
    },
  },
  {
    it: 'select specific columns (unqualified, single table)',
    query: db.selectFrom('users').select(['id', 'name']),
    result: {
      selection: { users: { id: true, name: true } },
      filter: { users: MATCH_ALL },
    },
  },
  {
    it: 'qualified columns',
    query: db.selectFrom('users').select('users.id'),
    result: {
      selection: { users: { id: true } },
      filter: { users: MATCH_ALL },
    },
  },
  {
    it: 'single table, unqualified columns with > operator',
    query: db.selectFrom('users').select(['id', 'name']).where('age', '>', 18),
    result: {
      selection: { users: { id: true, name: true } },
      filter: { users: [{ age: MATCH_ALL }] },
    },
  },
  {
    it: 'multiple tables with inner join',
    query: db
      .selectFrom('users')
      .innerJoin('posts', 'posts.user_id', 'users.id')
      .select(['users.id', 'posts.title']),
    result: {
      selection: {
        users: { id: true },
        posts: { title: true },
      },
      filter: {
        users: MATCH_ALL,
        posts: MATCH_ALL,
      },
    },
  },
  {
    it: 'left join — table appears, ON columns skipped',
    query: db.selectFrom('users').leftJoin('posts', 'posts.user_id', 'users.id').select('users.id'),
    result: {
      selection: { users: { id: true } },
      filter: { users: MATCH_ALL },
    },
  },
  {
    it: 'left join with unknown column in WHERE → filter widened to both tables',
    query: db
      .selectFrom('users')
      .leftJoin('posts', 'posts.user_id', 'users.id')
      .select('users.id')
      .where('age', '=', 34),
    result: {
      selection: { users: { id: true } },
      filter: {
        users: [{ age: { $in: [34] } }],
        posts: [{ age: { $in: [34] } }],
      },
    },
  },
  {
    it: 'left join — select all',
    query: db.selectFrom('users').leftJoin('posts', 'posts.user_id', 'users.id').selectAll(),
    result: {
      selection: { users: true, posts: true },
      filter: { users: MATCH_ALL, posts: MATCH_ALL },
    },
  },
  // ---- WHERE operators ----
  {
    it: 'WHERE with = operator',
    query: db.selectFrom('users').select('id').where('name', '=', 'John'),
    result: {
      selection: { users: { id: true } },
      filter: { users: [{ name: { $in: ['John'] } }] },
    },
  },
  {
    it: 'WHERE with in operator',
    query: db.selectFrom('users').select('id').where('name', 'in', ['Alice', 'Bob']),
    result: {
      selection: { users: { id: true } },
      filter: { users: [{ name: { $in: ['Alice', 'Bob'] } }] },
    },
  },
  {
    it: 'WHERE with > operator → value MATCH_ALL',
    query: db.selectFrom('users').select('id').where('age', '>', 18),
    result: {
      selection: { users: { id: true } },
      filter: { users: [{ age: MATCH_ALL }] },
    },
  },
  {
    it: 'WHERE with is operator → value MATCH_ALL',
    query: db.selectFrom('users').select('id').where('deleted', 'is', null),
    result: {
      selection: { users: { id: true } },
      filter: { users: [{ deleted: MATCH_ALL }] },
    },
  },
  {
    it: 'multiple WHERE (AND) — merged into one narrow filter entry',
    query: db.selectFrom('users').select('id').where('name', '=', 'John').where('age', '>', 18),
    result: {
      selection: { users: { id: true } },
      filter: {
        users: [{ name: { $in: ['John'] }, age: MATCH_ALL }],
      },
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
      selection: { users: { id: true } },
      filter: {
        users: [{ name: { $in: ['John', 'Jane'] } }],
      },
    },
  },
  {
    it: 'unqualified column in multi-table query → filter applied to all queried tables',
    query: db
      .selectFrom('users')
      .innerJoin('posts', 'posts.user_id', 'users.id')
      .select(['users.id', 'posts.title'])
      .where('age', '>', 18),
    result: {
      selection: {
        users: { id: true },
        posts: { title: true },
      },
      filter: {
        users: [{ age: MATCH_ALL }],
        posts: [{ age: MATCH_ALL }],
      },
    },
  },
  {
    it: 'column alias — select(users.id as uid)',
    query: db.selectFrom('users').select('users.id as uid'),
    result: {
      selection: { users: { id: true } },
      filter: { users: MATCH_ALL },
    },
  },
  {
    it: 'table alias — selectFrom(users as u).select(u.id)',
    query: db.selectFrom('users as u').select('u.id'),
    result: {
      selection: { users: { id: true } },
      filter: { users: MATCH_ALL },
    },
  },
  {
    it: 'table alias in WHERE',
    query: db.selectFrom('users as u').select('u.id').where('u.name', '=', 'John'),
    result: {
      selection: { users: { id: true } },
      filter: { users: [{ name: { $in: ['John'] } }] },
    },
  },
  {
    it: 'selectAll(users) on inner join — users widened; posts still produces a filter entry',
    query: db
      .selectFrom('users')
      .innerJoin('posts', 'posts.user_id', 'users.id')
      .selectAll('users'),
    result: {
      selection: { users: true },
      filter: { users: MATCH_ALL, posts: MATCH_ALL },
    },
  },
  {
    it: 'bare selectAll() with multiple tables — widen all',
    query: db.selectFrom('users').innerJoin('posts', 'posts.user_id', 'users.id').selectAll(),
    result: {
      selection: { users: true, posts: true },
      filter: { users: MATCH_ALL, posts: MATCH_ALL },
    },
  },
  {
    it: 'WHERE subquery — column widened to all, table+column scope preserved',
    query: db
      .selectFrom('users')
      .select('users.id')
      .where('users.id', 'in', db.selectFrom('posts').select('posts.user_id')),
    result: {
      selection: { users: { id: true } },
      filter: {
        users: [{ id: MATCH_ALL }],
        posts: [{ user_id: MATCH_ALL }],
      },
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
      selection: {
        users: { id: true },
        posts: { title: true },
      },
      filter: {
        users: [{ age: MATCH_ALL, name: { $in: ['John'] } }],
        posts: [{ age: MATCH_ALL, tag: { $in: ['news', 'archive'] } }],
      },
    },
  },
  {
    it: 'select with multiple froms',
    query: db.selectFrom(['users', 'posts']).select(['users.id', 'posts.title']),
    result: {
      selection: {
        users: { id: true },
        posts: { title: true },
      },
      filter: {
        users: MATCH_ALL,
        posts: MATCH_ALL,
      },
    },
  },
  {
    it: 'column both selected and filtered with =',
    query: db.selectFrom('users').select('name').where('name', '=', 'John'),
    result: {
      selection: { users: { name: true } },
      filter: { users: [{ name: { $in: ['John'] } }] },
    },
  },
  {
    it: 'column both selected and filtered with unknown operator',
    query: db.selectFrom('users').select('age').where('age', '>', 18),
    result: {
      selection: { users: { age: true } },
      filter: { users: [{ age: MATCH_ALL }] },
    },
  },
  // ---- OR / DNF ----
  {
    it: 'OR of two eq predicates → two filter entries',
    query: db
      .selectFrom('users')
      .select('id')
      .where(eb => eb.or([eb('name', '=', 'John'), eb('name', '=', 'Jane')])),
    result: {
      selection: { users: { id: true } },
      filter: {
        users: [{ name: { $in: ['John'] } }, { name: { $in: ['Jane'] } }],
      },
    },
  },
  {
    it: '(a=1 AND b=2) OR c=3 → two filter entries',
    query: db
      .selectFrom('users')
      .select('id')
      .where(eb =>
        eb.or([eb.and([eb('name', '=', 'John'), eb('age', '=', 30)]), eb('deleted', '=', true)]),
      ),
    result: {
      selection: { users: { id: true } },
      filter: {
        users: [
          { name: { $in: ['John'] }, age: { $in: [30] } },
          { deleted: { $in: [true] } },
        ],
      },
    },
  },
  // ---- writes ----
  {
    it: 'insert query → undefined',
    query: db.insertInto('users').values({ id: 1, name: 'John', age: 30, deleted: false }),
    result: undefined,
  },
  {
    it: 'update query → undefined',
    query: db.updateTable('users').set({ name: 'Jane' }).where('id', '=', 1),
    result: undefined,
  },
  {
    it: 'delete query → undefined',
    query: db.deleteFrom('users').where('id', '=', 1),
    result: undefined,
  },
  // ---- raw SQL ----
  {
    it: 'raw sql in SELECT → selection true',
    query: db
      .selectFrom('users')
      .select(['users.id', sql<string>`concat(first_name, ' ', last_name)`.as('full_name')]),
    result: {
      selection: true,
      filter: { users: MATCH_ALL },
    },
  },
  {
    it: 'raw sql left operand in WHERE → table filter MATCH_ALL',
    query: db
      .selectFrom('users')
      .select('id')
      .where(sql`lower(name)`, '=', 'john'),
    result: {
      selection: { users: { id: true } },
      filter: { users: MATCH_ALL },
    },
  },
  {
    it: 'raw sql as full WHERE expression → table filter MATCH_ALL',
    query: db
      .selectFrom('users')
      .select('id')
      .where(sql<SqlBool>`name ILIKE '%john%'`),
    result: {
      selection: { users: { id: true } },
      filter: { users: MATCH_ALL },
    },
  },
  {
    it: 'raw sql on right side of = → value MATCH_ALL',
    query: db
      .selectFrom('users')
      .select('id')
      .where('name', '=', sql<string>`lower('JOHN')`),
    result: {
      selection: { users: { id: true } },
      filter: { users: [{ name: MATCH_ALL }] },
    },
  },
  {
    it: 'raw sql on right side of in → value MATCH_ALL',
    query: db
      .selectFrom('users')
      .select('id')
      .where('name', 'in', sql<string>`(select name from admins)`),
    result: {
      selection: { users: { id: true } },
      filter: { users: [{ name: MATCH_ALL }] },
    },
  },
  {
    it: 'regular columns alongside raw sql in SELECT → selection true',
    query: db
      .selectFrom('users')
      .select(['users.id', 'users.name', sql<number>`extract(year from created_at)`.as('year')]),
    result: {
      selection: true,
      filter: { users: MATCH_ALL },
    },
  },
  {
    it: 'raw sql in WHERE mixed with eq filter → AND identity keeps narrow branch',
    query: db
      .selectFrom('users')
      .select('id')
      .where('name', '=', 'John')
      .where(sql<SqlBool>`age > 18`),
    result: {
      selection: { users: { id: true } },
      filter: {
        users: [{ name: { $in: ['John'] } }],
      },
    },
  },
  // ---- HAVING ----
  {
    it: 'HAVING present → filter collapses to MATCH_ALL',
    query: db.selectFrom('users').select('age').groupBy('age').having('age', '=', 25),
    result: {
      selection: { users: { age: true } },
      filter: { users: MATCH_ALL },
    },
  },
  {
    it: 'WHERE + HAVING — HAVING MATCH_ALL supersedes narrow WHERE entry',
    query: db
      .selectFrom('users')
      .select('age')
      .where('name', '=', 'John')
      .groupBy('age')
      .having('age', '>', 18),
    result: {
      selection: { users: { age: true } },
      filter: { users: MATCH_ALL },
    },
  },
  {
    it: 'HAVING without GROUP BY',
    query: db.selectFrom('users').selectAll().having('deleted', '=', false),
    result: {
      selection: { users: true },
      filter: { users: MATCH_ALL },
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
      selection: {
        users: { name: true },
        posts: { tag: true },
      },
      filter: {
        users: MATCH_ALL,
        posts: MATCH_ALL,
      },
    },
  },
  {
    it: 'AND of two = on same column (contradiction, treated as union)',
    query: db
      .selectFrom('users')
      .select('id')
      .where('name', '=', 'John')
      .where('name', '=', 'Jane'),
    result: {
      selection: { users: { id: true } },
      filter: {
        users: [{ name: { $in: ['John', 'Jane'] } }],
      },
    },
  },
  {
    it: 'IN list with a non-literal element → value MATCH_ALL',
    query: db
      .selectFrom('users')
      .select('id')
      .where(eb => eb('name', 'in', [sql<string>`lower('JOHN')`, 'Bob'])),
    result: {
      selection: { users: { id: true } },
      filter: { users: [{ name: MATCH_ALL }] },
    },
  },
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
      selection: { users: { id: true } },
      filter: {
        users: [{ name: { $in: ['John'] }, age: { $in: [30] } }],
      },
    },
  },
  {
    it: 'inner join where joined table is not selected still produces a filter entry',
    query: db
      .selectFrom('users')
      .innerJoin('posts', 'posts.user_id', 'users.id')
      .select('users.id'),
    result: {
      selection: { users: { id: true } },
      filter: { users: MATCH_ALL, posts: MATCH_ALL },
    },
  },
  {
    it: 'NOT predicate over an equality → value MATCH_ALL',
    query: db
      .selectFrom('users')
      .select('id')
      .where(eb => eb.not(eb('name', '=', 'John'))),
    result: {
      selection: { users: { id: true } },
      filter: { users: [{ name: MATCH_ALL }] },
    },
  },
  {
    it: 'subquery used as a table in FROM propagates inner tables',
    query: db.selectFrom(eb => eb.selectFrom('users').select('users.id').as('u')).select('u.id'),
    result: {
      selection: { users: { id: true } },
      filter: { users: MATCH_ALL },
    },
  },
  {
    it: 'CTE (WITH) — referenced base tables propagate to the outer output',
    query: db
      .with('active_users', d =>
        d.selectFrom('users').select('users.id').where('deleted', '=', false),
      )
      .selectFrom('active_users')
      .select('id'),
    result: {
      selection: { users: { id: true } },
      filter: {
        users: [{ deleted: { $in: [false] } }],
      },
    },
  },
]

describe('queryToChangeSubscription', () => {
  for (const t of tests) {
    it(t.it, () => {
      expect(queryToChangeSubscription<DB>(t.query)).toEqual(t.result)
    })
  }
})
