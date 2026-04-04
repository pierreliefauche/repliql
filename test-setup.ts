/**
 * Global test setup for Bun test runner
 * This file is preloaded before running tests via bunfig.toml
 */

import { beforeAll, afterAll } from 'bun:test'

beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = 'test'
  // Add other global setup as needed
})

afterAll(() => {
  // Global cleanup after all tests
})
