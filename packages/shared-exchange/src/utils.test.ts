import { describe, it, expect } from 'bun:test'

import { gql, CombinedError, type Operation, type OperationResult } from '@urql/core'

import { serializeOp, deserializeOp, serializeResult, deserializeResult } from './utils'

describe('utils', () => {
  const createMockOperation = (overrides: Partial<Operation> = {}): Operation =>
    ({
      key: 12345,
      kind: 'query' as const,
      query: gql`
        query TestQuery($id: ID!) {
          user(id: $id) {
            id
            name
          }
        }
      `,
      variables: { id: '123' },
      extensions: { foo: 'bar' },
      context: {
        url: 'https://api.example.com/graphql',
        requestPolicy: 'cache-first',
        fetchOptions: { headers: { Authorization: 'Bearer token' } },
      },
      ...overrides,
    }) as Operation

  describe('serializeOp', () => {
    it('serializes an operation with all fields', () => {
      const op = createMockOperation()
      const serialized = serializeOp(op)

      expect(serialized.key).toBe(12345)
      expect(serialized.kind).toBe('query')
      expect(serialized.query).toBe(op.query)
      expect(serialized.variables).toEqual({ id: '123' })
      expect(serialized.extensions).toEqual({ foo: 'bar' })
      expect(serialized.context.url).toBe('https://api.example.com/graphql')
    })

    it('calls fetchOptions function when present', () => {
      const fetchOptionsFn = () => ({ headers: { 'X-Custom': 'value' } })
      const op = createMockOperation({
        context: {
          operationId: '',
          url: 'https://api.example.com/graphql',
          requestPolicy: 'cache-first',
          fetchOptions: fetchOptionsFn,
        },
      })

      const serialized = serializeOp(op)
      expect(serialized.context.fetchOptions).toEqual({ headers: { 'X-Custom': 'value' } })
    })
  })

  describe('deserializeOp', () => {
    it('reconstructs an operation from serialized form', () => {
      const op = createMockOperation()
      const serialized = serializeOp(op)
      const deserialized = deserializeOp(serialized)

      expect(deserialized.key).toBe(12345)
      expect(deserialized.kind).toBe('query')
      expect(deserialized.variables).toEqual({ id: '123' })
    })

    it('re-hydrates non-serializable context from original operation', () => {
      const originalFetchOptions = () => ({ headers: { Authorization: 'Bearer original' } })
      const originalOp = createMockOperation({
        context: {
          operationId: '',
          url: 'https://api.example.com/graphql',
          requestPolicy: 'cache-first',
          fetchOptions: originalFetchOptions,
        },
      })

      const serialized = {
        key: 12345,
        kind: 'query' as const,
        query: originalOp.query,
        variables: { id: '456' }, // modified variable
        extensions: {},
        context: { url: 'https://api.example.com/graphql', requestPolicy: 'network-only' as const },
      }

      const deserialized = deserializeOp(serialized, originalOp)
      expect(deserialized.variables).toEqual({ id: '456' }) // keeps serialized values
      expect(deserialized.context.fetchOptions).toBe(originalFetchOptions) // preserves function
    })
  })

  describe('serializeResult', () => {
    it('serializes a successful result', () => {
      const op = createMockOperation()
      const result: OperationResult = {
        operation: op,
        data: { user: { id: '123', name: 'John' } },
        stale: false,
        hasNext: false,
      }

      const serialized = serializeResult(result)

      expect(serialized.key).toBe(12345)
      expect(serialized.data).toEqual({ user: { id: '123', name: 'John' } })
      expect(serialized.error).toBeUndefined()
      expect(serialized.stale).toBe(false)
      expect(serialized.hasNext).toBe(false)
    })

    it('serializes a result with GraphQL errors', () => {
      const op = createMockOperation()
      const result: OperationResult = {
        operation: op,
        data: null,
        error: new CombinedError({
          graphQLErrors: [
            { message: 'User not found', extensions: { code: 'NOT_FOUND' } },
            { message: 'Another error' },
          ],
        }),
        stale: false,
        hasNext: false,
      }

      const serialized = serializeResult(result)

      expect(serialized.error).toBeDefined()
      expect(serialized.error!.message).toContain('User not found')
      expect(serialized.error!.graphQLErrors).toHaveLength(2)
      expect(serialized.error!.graphQLErrors[0].message).toBe('User not found')
      expect(serialized.error!.graphQLErrors[0].extensions).toEqual({ code: 'NOT_FOUND' })
      expect(serialized.error!.networkError).toBeUndefined()
    })

    it('serializes a result with network error', () => {
      const op = createMockOperation()
      const result: OperationResult = {
        operation: op,
        data: null,
        error: new CombinedError({
          networkError: new Error('Network failure'),
        }),
        stale: false,
        hasNext: false,
      }

      const serialized = serializeResult(result)

      expect(serialized.error).toBeDefined()
      expect(serialized.error!.networkError).toBeDefined()
      expect(serialized.error!.networkError!.message).toBe('Network failure')
    })

    it('serializes a stale result with hasNext', () => {
      const op = createMockOperation()
      const result: OperationResult = {
        operation: op,
        data: { user: { id: '123' } },
        stale: true,
        hasNext: true,
      }

      const serialized = serializeResult(result)

      expect(serialized.stale).toBe(true)
      expect(serialized.hasNext).toBe(true)
    })
  })

  describe('deserializeResult', () => {
    it('deserializes a successful result', () => {
      const op = createMockOperation()
      const serialized = {
        handle: 'query:TestQuery',
        key: 12345,
        data: { user: { id: '123', name: 'John' } },
        stale: false,
        hasNext: false,
      }

      const result = deserializeResult(serialized, op)

      expect(result.operation).toBe(op)
      expect(result.data).toEqual({ user: { id: '123', name: 'John' } })
      expect(result.error).toBeUndefined()
      expect(result.stale).toBe(false)
      expect(result.hasNext).toBe(false)
    })

    it('deserializes a result with GraphQL errors', () => {
      const op = createMockOperation()
      const serialized = {
        handle: 'query:TestQuery',
        key: 12345,
        data: null,
        error: {
          message: '[GraphQL] User not found',
          graphQLErrors: [{ message: 'User not found', extensions: { code: 'NOT_FOUND' } }],
        },
        stale: false,
        hasNext: false,
      }

      const result = deserializeResult(serialized, op)

      expect(result.error).toBeInstanceOf(CombinedError)
      expect(result.error!.graphQLErrors).toHaveLength(1)
      expect(result.error!.graphQLErrors[0].message).toBe('User not found')
    })

    it('deserializes a result with network error', () => {
      const op = createMockOperation()
      const serialized = {
        handle: 'query:TestQuery',
        key: 12345,
        data: null,
        error: {
          message: '[Network] Network failure',
          graphQLErrors: [],
          networkError: { message: 'Network failure' },
        },
        stale: false,
        hasNext: false,
      }

      const result = deserializeResult(serialized, op)

      expect(result.error).toBeInstanceOf(CombinedError)
      expect(result.error!.networkError).toBeInstanceOf(Error)
      expect(result.error!.networkError!.message).toBe('Network failure')
    })
  })
})
