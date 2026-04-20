import { describe, it, expect } from 'bun:test'

import { parse } from '@0no-co/graphql.web'

import type { Entity } from './entities'
import { transformQueryData } from './transformQueryData'

// Helper to create a simple getFieldName that returns the alias or name
const simpleFieldName = ({ name, alias }: { name: string; alias?: string }) => alias ?? name

// Helper to create a getFieldName that includes args
const fieldNameWithArgs = ({
  name,
  alias,
  args,
}: {
  name: string
  alias?: string
  args?: Record<string, unknown>
}) => {
  const base = alias ?? name
  if (args && Object.keys(args).length) {
    return `${base}(${JSON.stringify(args)})`
  }
  return base
}

// Helper to create entity reference strings
const toRef = (entity: Entity) => `${entity.__typename}:${entity.id}`

describe('transformQueryData', () => {
  describe('basic queries', () => {
    it('transforms a simple scalar field', () => {
      const query = parse(`{ name }`)
      const data = { name: 'Alice' }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        toRef,
      )

      expect(result).toEqual({ name: 'Alice' })
    })

    it('transforms multiple scalar fields', () => {
      const query = parse(`{ name age active }`)
      const data = { name: 'Bob', age: 30, active: true }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        toRef,
      )

      expect(result).toEqual({ name: 'Bob', age: 30, active: true })
    })

    it('handles null values', () => {
      const query = parse(`{ user }`)
      const data = { user: null }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        toRef,
      )

      expect(result).toEqual({ user: null })
    })

    it('handles undefined data gracefully', () => {
      const query = parse(`{ user }`)
      const data = { user: undefined }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        toRef,
      )

      expect(result).toEqual({ user: undefined })
    })
  })

  describe('nested objects', () => {
    it('transforms nested object fields', () => {
      const query = parse(`{
        user {
          name
          email
        }
      }`)
      const data = { user: { name: 'Alice', email: 'alice@example.com' } }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        toRef,
      )

      expect(result).toEqual({ user: { name: 'Alice', email: 'alice@example.com' } })
    })

    it('transforms deeply nested objects', () => {
      const query = parse(`{
        company {
          name
          ceo {
            name
            contact {
              email
            }
          }
        }
      }`)
      const data = {
        company: {
          name: 'Acme',
          ceo: {
            name: 'John',
            contact: { email: 'john@acme.com' },
          },
        },
      }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        toRef,
      )

      expect(result).toEqual({
        company: {
          name: 'Acme',
          ceo: {
            name: 'John',
            contact: { email: 'john@acme.com' },
          },
        },
      })
    })
  })

  describe('arrays', () => {
    it('transforms arrays of scalars', () => {
      const query = parse(`{ tags }`)
      const data = { tags: ['a', 'b', 'c'] }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        toRef,
      )

      // Scalars in arrays are returned as-is
      expect(result).toEqual({ tags: ['a', 'b', 'c'] })
    })

    it('transforms arrays of objects', () => {
      const query = parse(`{
        users {
          name
        }
      }`)
      const data = { users: [{ name: 'Alice' }, { name: 'Bob' }] }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        toRef,
      )

      expect(result).toEqual({ users: [{ name: 'Alice' }, { name: 'Bob' }] })
    })

    it('transforms nested arrays', () => {
      const query = parse(`{
        matrix {
          items {
            value
          }
        }
      }`)
      const data = {
        matrix: [{ items: [{ value: 1 }, { value: 2 }] }, { items: [{ value: 3 }] }],
      }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        toRef,
      )

      expect(result).toEqual({
        matrix: [{ items: [{ value: 1 }, { value: 2 }] }, { items: [{ value: 3 }] }],
      })
    })

    it('handles empty arrays', () => {
      const query = parse(`{
        users {
          name
        }
      }`)
      const data = { users: [] }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        toRef,
      )

      expect(result).toEqual({ users: [] })
    })

    it('handles null items in arrays', () => {
      const query = parse(`{
        users {
          name
        }
      }`)
      const data = { users: [{ name: 'Alice' }, null, { name: 'Bob' }] }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        toRef,
      )

      expect(result).toEqual({ users: [{ name: 'Alice' }, null, { name: 'Bob' }] })
    })
  })

  describe('aliases', () => {
    it('uses alias in output field name', () => {
      // GraphQL responses use the alias as the key
      const query = parse(`{
        primaryUser: user {
          displayName: name
        }
      }`)
      const data = { primaryUser: { displayName: 'Alice' } }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        toRef,
      )

      expect(result).toEqual({ primaryUser: { displayName: 'Alice' } })
    })

    it('respects the field name option', () => {
      // GraphQL responses use the alias as the key
      const query = parse(`{
        primaryUser: user {
          displayName: name
        }
      }`)
      const data = { primaryUser: { displayName: 'Alice' } }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: ({ name }) => name },
        toRef,
      )

      expect(result).toEqual({ user: { name: 'Alice' } })
    })

    it('handles multiple aliases of the same field', () => {
      const query = parse(`{
        first: user(id: "1") {
          name
        }
        second: user(id: "2") {
          name
        }
      }`)
      // GraphQL responses use aliases as keys
      const data = {
        first: { name: 'Alice' },
        second: { name: 'Bob' },
      }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        toRef,
      )

      expect(result).toEqual({
        first: { name: 'Alice' },
        second: { name: 'Bob' },
      })
    })
  })

  describe('field arguments', () => {
    it('includes arguments in field name via getFieldName', () => {
      const query = parse(`{
        user(id: "123") {
          name
        }
      }`)
      const data = { user: { name: 'Alice' } }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: fieldNameWithArgs },
        toRef,
      )

      expect(result).toEqual({ 'user({"id":"123"})': { name: 'Alice' } })
    })

    it('handles multiple arguments', () => {
      const query = parse(`{
        users(first: 10, after: "cursor") {
          name
        }
      }`)
      const data = { users: [{ name: 'Alice' }] }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: fieldNameWithArgs },
        toRef,
      )

      expect(result).toEqual({ 'users({"first":10,"after":"cursor"})': [{ name: 'Alice' }] })
    })
  })

  describe('variables', () => {
    it('resolves variable references', () => {
      const query = parse(`
        query GetUser($id: ID!) {
          user(id: $id) {
            name
          }
        }
      `)
      const data = { user: { name: 'Alice' } }
      const variables = { id: '123' }

      const result = transformQueryData(
        { query, data, variables, getFieldName: fieldNameWithArgs },
        toRef,
      )

      expect(result).toEqual({ 'user({"id":"123"})': { name: 'Alice' } })
    })

    it('handles INT variable type', () => {
      const query = parse(`
        query GetUsers($count: Int!) {
          users(first: $count) {
            name
          }
        }
      `)
      const data = { users: [{ name: 'Alice' }] }
      const variables = { count: 5 }

      const result = transformQueryData(
        { query, data, variables, getFieldName: fieldNameWithArgs },
        toRef,
      )

      expect(result).toEqual({ 'users({"first":5})': [{ name: 'Alice' }] })
    })

    it('handles inline INT literal', () => {
      const query = parse(`{
        users(first: 10) {
          name
        }
      }`)
      const data = { users: [{ name: 'Alice' }] }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: fieldNameWithArgs },
        toRef,
      )

      expect(result).toEqual({ 'users({"first":10})': [{ name: 'Alice' }] })
    })

    it('handles inline FLOAT literal', () => {
      const query = parse(`{
        products(minPrice: 9.99) {
          name
        }
      }`)
      const data = { products: [{ name: 'Widget' }] }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: fieldNameWithArgs },
        toRef,
      )

      expect(result).toEqual({ 'products({"minPrice":9.99})': [{ name: 'Widget' }] })
    })

    it('handles inline STRING literal', () => {
      const query = parse(`{
        user(name: "Alice") {
          id
        }
      }`)
      const data = { user: { id: '123' } }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: fieldNameWithArgs },
        toRef,
      )

      expect(result).toEqual({ 'user({"name":"Alice"})': { id: '123' } })
    })

    it('handles inline BOOLEAN literal', () => {
      const query = parse(`{
        users(active: true) {
          name
        }
      }`)
      const data = { users: [{ name: 'Alice' }] }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: fieldNameWithArgs },
        toRef,
      )

      expect(result).toEqual({ 'users({"active":true})': [{ name: 'Alice' }] })
    })

    it('handles inline NULL literal', () => {
      const query = parse(`{
        users(filter: null) {
          name
        }
      }`)
      const data = { users: [{ name: 'Alice' }] }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: fieldNameWithArgs },
        toRef,
      )

      expect(result).toEqual({ 'users({"filter":null})': [{ name: 'Alice' }] })
    })

    it('handles inline ENUM literal', () => {
      const query = parse(`{
        users(status: ACTIVE) {
          name
        }
      }`)
      const data = { users: [{ name: 'Alice' }] }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: fieldNameWithArgs },
        toRef,
      )

      expect(result).toEqual({ 'users({"status":"ACTIVE"})': [{ name: 'Alice' }] })
    })

    it('handles inline LIST literal', () => {
      const query = parse(`{
        users(ids: ["1", "2", "3"]) {
          name
        }
      }`)
      const data = { users: [{ name: 'Alice' }] }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: fieldNameWithArgs },
        toRef,
      )

      expect(result).toEqual({ 'users({"ids":["1","2","3"]})': [{ name: 'Alice' }] })
    })

    it('handles inline OBJECT literal', () => {
      const query = parse(`{
        users(filter: { name: "Alice", age: 30 }) {
          name
        }
      }`)
      const data = { users: [{ name: 'Alice' }] }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: fieldNameWithArgs },
        toRef,
      )

      expect(result).toEqual({
        'users({"filter":{"name":"Alice","age":30}})': [{ name: 'Alice' }],
      })
    })

    it('handles nested LIST with OBJECT', () => {
      const query = parse(`{
        users(filters: [{ field: "name", value: "A" }, { field: "age", value: "30" }]) {
          name
        }
      }`)
      const data = { users: [{ name: 'Alice' }] }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: fieldNameWithArgs },
        toRef,
      )

      expect(result).toEqual({
        'users({"filters":[{"field":"name","value":"A"},{"field":"age","value":"30"}]})': [
          { name: 'Alice' },
        ],
      })
    })
  })

  describe('entities', () => {
    it('replaces entity with replacer result', () => {
      const query = parse(`{
        user {
          __typename
          id
          name
        }
      }`)
      const data = { user: { __typename: 'User', id: '1', name: 'Alice' } }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        toRef,
      )

      expect(result).toEqual({ user: 'User:1' })
    })

    it('replaces entities in arrays', () => {
      const query = parse(`{
        users {
          __typename
          id
          name
        }
      }`)
      const data = {
        users: [
          { __typename: 'User', id: '1', name: 'Alice' },
          { __typename: 'User', id: '2', name: 'Bob' },
        ],
      }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        toRef,
      )

      expect(result).toEqual({ users: ['User:1', 'User:2'] })
    })

    it('replaces nested entities', () => {
      const query = parse(`{
        user {
          __typename
          id
          profile {
            __typename
            id
            bio
          }
        }
      }`)
      const data = {
        user: {
          __typename: 'User',
          id: '1',
          profile: { __typename: 'Profile', id: 'p1', bio: 'Hello' },
        },
      }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        toRef,
      )

      // Note: because user is replaced first (leaf-to-root), and profile is nested,
      // the profile gets replaced, then the user (with profile already replaced) gets replaced
      expect(result).toEqual({ user: 'User:1' })
    })

    it('preserves non-entity objects', () => {
      const query = parse(`{
        config {
          theme
          locale
        }
      }`)
      const data = { config: { theme: 'dark', locale: 'en' } }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        toRef,
      )

      // No __typename or id, so not an entity
      expect(result).toEqual({ config: { theme: 'dark', locale: 'en' } })
    })

    it('preserves objects with __typename but no id', () => {
      const query = parse(`{
        result {
          __typename
          success
          message
        }
      }`)
      const data = { result: { __typename: 'Result', success: true, message: 'Done' } }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        toRef,
      )

      // Has __typename but no id, so not an entity
      expect(result).toEqual({ result: { __typename: 'Result', success: true, message: 'Done' } })
    })

    it('preserves __typename even when not in selection set', () => {
      const query = parse(`{
        user {
          id
          name
        }
      }`)
      // Data has __typename even though query doesn't select it
      const data = { user: { __typename: 'User', id: '1', name: 'Alice' } }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        toRef,
      )

      // __typename is preserved and entity is detected
      expect(result).toEqual({ user: 'User:1' })
    })

    it('handles mixed entity and non-entity in arrays', () => {
      const query = parse(`{
        items {
          __typename
          id
          name
        }
      }`)
      const data = {
        items: [
          { __typename: 'User', id: '1', name: 'Alice' },
          { __typename: 'Config', name: 'Settings' }, // No id, not an entity
        ],
      }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        toRef,
      )

      expect(result).toEqual({
        items: ['User:1', { __typename: 'Config', name: 'Settings' }],
      })
    })
  })

  describe('fragments', () => {
    describe('named fragments', () => {
      it('processes fields from named fragment', () => {
        const query = parse(`
          query {
            user {
              ...UserFields
            }
          }
          fragment UserFields on User {
            name
            email
          }
        `)
        const data = { user: { name: 'Alice', email: 'alice@example.com' } }

        const result = transformQueryData(
          { query, data, variables: {}, getFieldName: simpleFieldName },
          toRef,
        )

        expect(result).toEqual({ user: { name: 'Alice', email: 'alice@example.com' } })
      })

      it('processes entity from named fragment', () => {
        const query = parse(`
          query {
            user {
              ...UserFields
            }
          }
          fragment UserFields on User {
            __typename
            id
            name
          }
        `)
        const data = { user: { __typename: 'User', id: '1', name: 'Alice' } }

        const result = transformQueryData(
          { query, data, variables: {}, getFieldName: simpleFieldName },
          toRef,
        )

        expect(result).toEqual({ user: 'User:1' })
      })

      it('processes nested fragments', () => {
        const query = parse(`
          query {
            user {
              ...UserFields
            }
          }
          fragment UserFields on User {
            name
            ...UserProfile
          }
          fragment UserProfile on User {
            bio
            avatar
          }
        `)
        const data = { user: { name: 'Alice', bio: 'Hello', avatar: 'pic.jpg' } }

        const result = transformQueryData(
          { query, data, variables: {}, getFieldName: simpleFieldName },
          toRef,
        )

        expect(result).toEqual({ user: { name: 'Alice', bio: 'Hello', avatar: 'pic.jpg' } })
      })

      it('merges fields from multiple fragments', () => {
        const query = parse(`
          query {
            user {
              ...NameFragment
              ...EmailFragment
            }
          }
          fragment NameFragment on User {
            name
          }
          fragment EmailFragment on User {
            email
          }
        `)
        const data = { user: { name: 'Alice', email: 'alice@example.com' } }

        const result = transformQueryData(
          { query, data, variables: {}, getFieldName: simpleFieldName },
          toRef,
        )

        expect(result).toEqual({ user: { name: 'Alice', email: 'alice@example.com' } })
      })

      it('handles fragment on array items', () => {
        const query = parse(`
          query {
            users {
              ...UserFields
            }
          }
          fragment UserFields on User {
            __typename
            id
            name
          }
        `)
        const data = {
          users: [
            { __typename: 'User', id: '1', name: 'Alice' },
            { __typename: 'User', id: '2', name: 'Bob' },
          ],
        }

        const result = transformQueryData(
          { query, data, variables: {}, getFieldName: simpleFieldName },
          toRef,
        )

        expect(result).toEqual({ users: ['User:1', 'User:2'] })
      })
    })

    describe('inline fragments', () => {
      it('processes fields from inline fragment without type condition', () => {
        const query = parse(`{
          user {
            ... {
              name
              email
            }
          }
        }`)
        const data = { user: { name: 'Alice', email: 'alice@example.com' } }

        const result = transformQueryData(
          { query, data, variables: {}, getFieldName: simpleFieldName },
          toRef,
        )

        expect(result).toEqual({ user: { name: 'Alice', email: 'alice@example.com' } })
      })

      it('processes fields from inline fragment with type condition', () => {
        const query = parse(`{
          user {
            ... on User {
              name
              email
            }
          }
        }`)
        const data = { user: { name: 'Alice', email: 'alice@example.com' } }

        const result = transformQueryData(
          { query, data, variables: {}, getFieldName: simpleFieldName },
          toRef,
        )

        expect(result).toEqual({ user: { name: 'Alice', email: 'alice@example.com' } })
      })

      it('merges fields from multiple inline fragments', () => {
        const query = parse(`{
          user {
            ... on User {
              name
            }
            ... on User {
              email
            }
          }
        }`)
        const data = { user: { name: 'Alice', email: 'alice@example.com' } }

        const result = transformQueryData(
          { query, data, variables: {}, getFieldName: simpleFieldName },
          toRef,
        )

        expect(result).toEqual({ user: { name: 'Alice', email: 'alice@example.com' } })
      })
    })
  })

  describe('interfaces', () => {
    it('handles interface with inline fragment for concrete type', () => {
      const query = parse(`{
        node {
          __typename
          ... on User {
            id
            name
          }
          ... on Post {
            id
            title
          }
        }
      }`)
      const data = { node: { __typename: 'User', id: '1', name: 'Alice' } }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        toRef,
      )

      // Without schema, all inline fragments are processed
      // Since data has __typename: User and id, it becomes an entity
      expect(result).toEqual({ node: 'User:1' })
    })

    it('handles interface with named fragment for concrete type', () => {
      const query = parse(`
        query {
          node {
            __typename
            ...UserFields
            ...PostFields
          }
        }
        fragment UserFields on User {
          id
          name
        }
        fragment PostFields on Post {
          id
          title
        }
      `)
      const data = { node: { __typename: 'Post', id: 'p1', title: 'Hello World' } }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        toRef,
      )

      expect(result).toEqual({ node: 'Post:p1' })
    })

    it('handles array of interface implementations', () => {
      const query = parse(`{
        nodes {
          __typename
          ... on User {
            id
            name
          }
          ... on Post {
            id
            title
          }
        }
      }`)
      const data = {
        nodes: [
          { __typename: 'User', id: '1', name: 'Alice' },
          { __typename: 'Post', id: 'p1', title: 'Hello' },
        ],
      }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        toRef,
      )

      expect(result).toEqual({ nodes: ['User:1', 'Post:p1'] })
    })

    it('handles nested interface fields', () => {
      const query = parse(`{
        timeline {
          __typename
          ... on Post {
            id
            author {
              __typename
              id
              name
            }
          }
          ... on Comment {
            id
            post {
              __typename
              id
              title
            }
          }
        }
      }`)
      const data = {
        timeline: [
          {
            __typename: 'Post',
            id: 'p1',
            author: { __typename: 'User', id: 'u1', name: 'Alice' },
          },
          {
            __typename: 'Comment',
            id: 'c1',
            post: { __typename: 'Post', id: 'p2', title: 'Hi' },
          },
        ],
      }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        toRef,
      )

      expect(result).toEqual({ timeline: ['Post:p1', 'Comment:c1'] })
    })

    it('handles interface implementing interface (multi-level)', () => {
      const query = parse(`{
        resource {
          __typename
          ... on Node {
            id
          }
          ... on NamedNode {
            id
            name
          }
          ... on User {
            id
            name
            email
          }
        }
      }`)
      const data = { resource: { __typename: 'User', id: '1', name: 'Alice', email: 'a@b.com' } }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        toRef,
      )

      expect(result).toEqual({ resource: 'User:1' })
    })
  })

  describe('unions', () => {
    it('handles union with inline fragments', () => {
      const query = parse(`{
        search {
          __typename
          ... on User {
            id
            name
          }
          ... on Post {
            id
            title
          }
          ... on Comment {
            id
            body
          }
        }
      }`)
      const data = { search: { __typename: 'User', id: '1', name: 'Alice' } }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        toRef,
      )

      expect(result).toEqual({ search: 'User:1' })
    })

    it('handles array of union results', () => {
      const query = parse(`{
        searchResults {
          __typename
          ... on User {
            id
            name
          }
          ... on Post {
            id
            title
          }
        }
      }`)
      const data = {
        searchResults: [
          { __typename: 'User', id: '1', name: 'Alice' },
          { __typename: 'Post', id: 'p1', title: 'Hello' },
          { __typename: 'User', id: '2', name: 'Bob' },
        ],
      }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        toRef,
      )

      expect(result).toEqual({ searchResults: ['User:1', 'Post:p1', 'User:2'] })
    })

    it('handles union with named fragments', () => {
      const query = parse(`
        query {
          media {
            __typename
            ...ImageFields
            ...VideoFields
          }
        }
        fragment ImageFields on Image {
          id
          url
          width
          height
        }
        fragment VideoFields on Video {
          id
          url
          duration
        }
      `)
      const data = {
        media: { __typename: 'Video', id: 'v1', url: 'video.mp4', duration: 120 },
      }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        toRef,
      )

      expect(result).toEqual({ media: 'Video:v1' })
    })

    it('handles nested union types', () => {
      const query = parse(`{
        feed {
          __typename
          ... on Post {
            id
            media {
              __typename
              ... on Image {
                id
                url
              }
              ... on Video {
                id
                url
              }
            }
          }
        }
      }`)
      const data = {
        feed: [
          {
            __typename: 'Post',
            id: 'p1',
            media: { __typename: 'Image', id: 'i1', url: 'img.jpg' },
          },
        ],
      }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        toRef,
      )

      expect(result).toEqual({ feed: ['Post:p1'] })
    })

    it('handles union with null member', () => {
      const query = parse(`{
        searchResults {
          __typename
          ... on User {
            id
            name
          }
          ... on Post {
            id
            title
          }
        }
      }`)
      const data = {
        searchResults: [
          { __typename: 'User', id: '1', name: 'Alice' },
          null,
          { __typename: 'Post', id: 'p1', title: 'Hello' },
        ],
      }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        toRef,
      )

      expect(result).toEqual({ searchResults: ['User:1', null, 'Post:p1'] })
    })

    it('handles union members without id (non-entities)', () => {
      const query = parse(`{
        result {
          __typename
          ... on Success {
            message
          }
          ... on Error {
            code
            message
          }
        }
      }`)
      const data = { result: { __typename: 'Error', code: 404, message: 'Not found' } }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        toRef,
      )

      // No id field, so not an entity - preserved as-is
      expect(result).toEqual({ result: { __typename: 'Error', code: 404, message: 'Not found' } })
    })
  })

  describe('complex mixed scenarios', () => {
    it('handles query with interface, union, fragments, and aliases', () => {
      const query = parse(`
        query Timeline($first: Int!) {
          timeline: feed(first: $first) {
            __typename
            ...NodeFields
            ... on Post {
              id
              postTitle: title
              author {
                ...UserFields
              }
            }
            ... on Article {
              id
              articleTitle: title
              publication
            }
          }
        }
        fragment NodeFields on Node {
          id
        }
        fragment UserFields on User {
          __typename
          id
          displayName: name
        }
      `)
      // Data uses aliases as keys (real GraphQL response shape)
      const data = {
        timeline: [
          {
            __typename: 'Post',
            id: 'p1',
            postTitle: 'Hello',
            author: { __typename: 'User', id: 'u1', displayName: 'Alice' },
          },
          {
            __typename: 'Article',
            id: 'a1',
            articleTitle: 'News',
            publication: 'Times',
          },
        ],
      }
      const variables = { first: 10 }

      const result = transformQueryData(
        { query, data, variables, getFieldName: simpleFieldName },
        toRef,
      )

      expect(result).toEqual({ timeline: ['Post:p1', 'Article:a1'] })
    })

    it('handles deeply nested union inside interface', () => {
      const query = parse(`{
        viewer {
          __typename
          ... on User {
            id
            feed {
              __typename
              ... on Post {
                id
                comments {
                  __typename
                  id
                  author {
                    __typename
                    id
                  }
                }
              }
            }
          }
        }
      }`)
      const data = {
        viewer: {
          __typename: 'User',
          id: 'u1',
          feed: [
            {
              __typename: 'Post',
              id: 'p1',
              comments: [
                { __typename: 'Comment', id: 'c1', author: { __typename: 'User', id: 'u2' } },
                { __typename: 'Comment', id: 'c2', author: { __typename: 'User', id: 'u3' } },
              ],
            },
          ],
        },
      }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        toRef,
      )

      expect(result).toEqual({ viewer: 'User:u1' })
    })

    it('handles connection pattern with edges and nodes', () => {
      const query = parse(`{
        users(first: 10) {
          edges {
            cursor
            node {
              __typename
              id
              name
              posts(first: 5) {
                edges {
                  node {
                    __typename
                    id
                    title
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }`)
      const data = {
        users: {
          edges: [
            {
              cursor: 'c1',
              node: {
                __typename: 'User',
                id: 'u1',
                name: 'Alice',
                posts: {
                  edges: [
                    { node: { __typename: 'Post', id: 'p1', title: 'Hello' } },
                    { node: { __typename: 'Post', id: 'p2', title: 'World' } },
                  ],
                },
              },
            },
          ],
          pageInfo: { hasNextPage: true, endCursor: 'xyz' },
        },
      }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        toRef,
      )

      expect(result).toEqual({
        users: {
          edges: [
            {
              cursor: 'c1',
              node: 'User:u1',
            },
          ],
          pageInfo: { hasNextPage: true, endCursor: 'xyz' },
        },
      })
    })

    it('custom replacer returns complex object', () => {
      const query = parse(`{
        user {
          __typename
          id
          name
        }
      }`)
      const data = { user: { __typename: 'User', id: '1', name: 'Alice' } }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        entity => ({ __ref: toRef(entity), timestamp: Date.now() }),
      )

      expect(result.user).toHaveProperty('__ref', 'User:1')
      expect(result.user).toHaveProperty('timestamp')
    })

    it('custom replacer returns the entity unchanged', () => {
      const query = parse(`{
        user {
          __typename
          id
          name
        }
      }`)
      const data = { user: { __typename: 'User', id: '1', name: 'Alice' } }

      const result = transformQueryData(
        { query, data, variables: {}, getFieldName: simpleFieldName },
        entity => entity,
      )

      expect(result).toEqual({ user: { __typename: 'User', id: '1', name: 'Alice' } })
    })
  })

  describe('error handling', () => {
    it('throws when no operation definition found', () => {
      const query = parse(`
        fragment UserFields on User {
          name
        }
      `)
      const data = {}

      expect(() =>
        transformQueryData({ query, data, variables: {}, getFieldName: simpleFieldName }, toRef),
      ).toThrow('No operation definition found')
    })
  })
})
