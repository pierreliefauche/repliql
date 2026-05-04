import { describe, expect, it, mock } from 'bun:test'

import { makeLogger, type LogLevel } from './logger'

describe('makeLogger', () => {
  const createMockConfig = () => ({
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
  })

  describe('log level filtering', () => {
    it.each<[LogLevel, LogLevel[], LogLevel[]]>([
      ['debug', ['debug', 'info', 'warn', 'error'], []],
      ['info', ['info', 'warn', 'error'], ['debug']],
      ['warn', ['warn', 'error'], ['debug', 'info']],
      ['error', ['error'], ['debug', 'info', 'warn']],
    ])('with level %s, calls %j and skips %j', (level, shouldCall, shouldSkip) => {
      const mocks = createMockConfig()
      const logger = makeLogger({ ...mocks, level, prefix: 'test' })

      logger.debug('debug message')
      logger.info('info message')
      logger.warn('warn message')
      logger.error('error message')

      for (const method of shouldCall) {
        expect(mocks[method]).toHaveBeenCalled()
      }
      for (const method of shouldSkip) {
        expect(mocks[method]).not.toHaveBeenCalled()
      }
    })
  })

  describe('prefix handling', () => {
    it('passes prefix to all log methods', () => {
      const mocks = createMockConfig()
      const logger = makeLogger({ ...mocks, level: 'debug', prefix: 'MyComponent' })

      logger.debug('test')
      logger.info('test')
      logger.warn('test')
      logger.error('test')

      expect(mocks.debug).toHaveBeenCalledWith('MyComponent', 'test')
      expect(mocks.info).toHaveBeenCalledWith('MyComponent', 'test')
      expect(mocks.warn).toHaveBeenCalledWith('MyComponent', 'test')
      expect(mocks.error).toHaveBeenCalledWith('MyComponent', 'test')
    })
  })

  describe('message and args forwarding', () => {
    it('forwards message and additional args to logging function', () => {
      const mocks = createMockConfig()
      const logger = makeLogger({ ...mocks, level: 'debug', prefix: 'test' })

      const obj = { key: 'value' }
      const arr = [1, 2, 3]

      logger.debug('message', obj, arr, 42)

      expect(mocks.debug).toHaveBeenCalledWith('test', 'message', obj, arr, 42)
    })
  })

  describe('dynamic level', () => {
    it('supports level as a function', () => {
      const mocks = createMockConfig()
      let currentLevel: LogLevel = 'debug'
      const logger = makeLogger({
        ...mocks,
        level: () => currentLevel,
        prefix: 'test',
      })

      logger.debug('first')
      expect(mocks.debug).toHaveBeenCalledTimes(1)

      currentLevel = 'error'
      logger.debug('second')
      expect(mocks.debug).toHaveBeenCalledTimes(1) // still 1, not called again

      logger.error('third')
      expect(mocks.error).toHaveBeenCalledTimes(1)
    })
  })

  describe('default level', () => {
    it('defaults to warn level when level is not specified', () => {
      const mocks = createMockConfig()
      const logger = makeLogger({ ...mocks, prefix: 'test' })

      logger.debug('test')
      logger.info('test')
      logger.warn('test')
      logger.error('test')
      expect(mocks.debug).not.toHaveBeenCalled()
      expect(mocks.info).not.toHaveBeenCalled()
      expect(mocks.warn).toHaveBeenCalled()
      expect(mocks.error).toHaveBeenCalled()
    })
  })

  describe('missing logging functions', () => {
    it('does not throw when logging function is not provided', () => {
      const logger = makeLogger({ level: 'debug', prefix: 'test' })

      expect(() => {
        logger.debug('test')
        logger.info('test')
        logger.warn('test')
        logger.error('test')
      }).not.toThrow()
    })

    it('only calls provided logging functions', () => {
      const infoMock = mock(() => {})
      const logger = makeLogger({ level: 'debug', prefix: 'test', info: infoMock })

      logger.debug('debug') // no debug function, should not throw
      logger.info('info')

      expect(infoMock).toHaveBeenCalledWith('test', 'info')
    })
  })
})
