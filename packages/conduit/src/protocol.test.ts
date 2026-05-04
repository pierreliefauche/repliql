import { describe, it, expect } from 'bun:test'

import {
  isDedicatedPortMessage,
  isRegisterTabMessage,
  isUnregisterTabMessage,
  isElectedLeaderMessage,
  LeaderResignedError,
  CONDUIT_DEDICATED_PORT,
  CONDUIT_REGISTER_TAB,
  CONDUIT_UNREGISTER_TAB,
  CONDUIT_ELECTED_LEADER,
} from './protocol'

describe('protocol', () => {
  describe('isDedicatedPortMessage', () => {
    it('accepts a properly tagged envelope with a MessagePort', () => {
      const channel = new MessageChannel()
      const message = { __conduit: CONDUIT_DEDICATED_PORT, port: channel.port1 }
      expect(isDedicatedPortMessage(message)).toBe(true)
    })

    it('rejects an untagged message even if it carries a port', () => {
      const channel = new MessageChannel()
      expect(isDedicatedPortMessage({ port: channel.port1 })).toBe(false)
    })

    it('rejects a tagged message whose port is not a MessagePort', () => {
      expect(isDedicatedPortMessage({ __conduit: CONDUIT_DEDICATED_PORT, port: {} })).toBe(false)
    })

    it('rejects unrelated payload types', () => {
      expect(isDedicatedPortMessage(null)).toBe(false)
      expect(isDedicatedPortMessage('hello')).toBe(false)
      expect(isDedicatedPortMessage(42)).toBe(false)
      expect(isDedicatedPortMessage(undefined)).toBe(false)
    })
  })

  describe('isRegisterTabMessage', () => {
    it('accepts a properly tagged envelope with tabId and MessagePort', () => {
      const channel = new MessageChannel()
      const message = { __conduit: CONDUIT_REGISTER_TAB, tabId: 'tab-1', port: channel.port1 }
      expect(isRegisterTabMessage(message)).toBe(true)
    })

    it('rejects an untagged message even if it carries tabId and port', () => {
      const channel = new MessageChannel()
      expect(isRegisterTabMessage({ tabId: 'tab-1', port: channel.port1 })).toBe(false)
    })

    it('rejects a tagged message with wrong conduit type', () => {
      const channel = new MessageChannel()
      expect(
        isRegisterTabMessage({
          __conduit: CONDUIT_DEDICATED_PORT,
          tabId: 'tab-1',
          port: channel.port1,
        }),
      ).toBe(false)
    })

    it('rejects a tagged message without tabId', () => {
      const channel = new MessageChannel()
      expect(isRegisterTabMessage({ __conduit: CONDUIT_REGISTER_TAB, port: channel.port1 })).toBe(
        false,
      )
    })

    it('rejects a tagged message with non-string tabId', () => {
      const channel = new MessageChannel()
      expect(
        isRegisterTabMessage({ __conduit: CONDUIT_REGISTER_TAB, tabId: 123, port: channel.port1 }),
      ).toBe(false)
    })

    it('rejects a tagged message whose port is not a MessagePort', () => {
      expect(
        isRegisterTabMessage({ __conduit: CONDUIT_REGISTER_TAB, tabId: 'tab-1', port: {} }),
      ).toBe(false)
    })

    it('rejects unrelated payload types', () => {
      expect(isRegisterTabMessage(null)).toBe(false)
      expect(isRegisterTabMessage('hello')).toBe(false)
      expect(isRegisterTabMessage(42)).toBe(false)
      expect(isRegisterTabMessage(undefined)).toBe(false)
    })
  })

  describe('isUnregisterTabMessage', () => {
    it('accepts a properly tagged envelope with tabId', () => {
      const message = { __conduit: CONDUIT_UNREGISTER_TAB, tabId: 'tab-1' }
      expect(isUnregisterTabMessage(message)).toBe(true)
    })

    it('rejects an untagged message even if it carries tabId', () => {
      expect(isUnregisterTabMessage({ tabId: 'tab-1' })).toBe(false)
    })

    it('rejects a tagged message with wrong conduit type', () => {
      expect(isUnregisterTabMessage({ __conduit: CONDUIT_REGISTER_TAB, tabId: 'tab-1' })).toBe(
        false,
      )
    })

    it('rejects a tagged message without tabId', () => {
      expect(isUnregisterTabMessage({ __conduit: CONDUIT_UNREGISTER_TAB })).toBe(false)
    })

    it('rejects a tagged message with non-string tabId', () => {
      expect(isUnregisterTabMessage({ __conduit: CONDUIT_UNREGISTER_TAB, tabId: 123 })).toBe(false)
    })

    it('rejects unrelated payload types', () => {
      expect(isUnregisterTabMessage(null)).toBe(false)
      expect(isUnregisterTabMessage('hello')).toBe(false)
      expect(isUnregisterTabMessage(42)).toBe(false)
      expect(isUnregisterTabMessage(undefined)).toBe(false)
    })
  })

  describe('isElectedLeaderMessage', () => {
    it('accepts a properly tagged envelope', () => {
      const message = { __conduit: CONDUIT_ELECTED_LEADER }
      expect(isElectedLeaderMessage(message)).toBe(true)
    })

    it('rejects an untagged message', () => {
      expect(isElectedLeaderMessage({})).toBe(false)
    })

    it('rejects a tagged message with wrong conduit type', () => {
      expect(isElectedLeaderMessage({ __conduit: CONDUIT_REGISTER_TAB })).toBe(false)
    })

    it('rejects unrelated payload types', () => {
      expect(isElectedLeaderMessage(null)).toBe(false)
      expect(isElectedLeaderMessage('hello')).toBe(false)
      expect(isElectedLeaderMessage(42)).toBe(false)
      expect(isElectedLeaderMessage(undefined)).toBe(false)
    })
  })

  describe('LeaderResignedError', () => {
    it('exposes a stable name', () => {
      const err = new LeaderResignedError()
      expect(err.name).toBe('LeaderResignedError')
      expect(err).toBeInstanceOf(Error)
    })

    it('uses default message when none provided', () => {
      const err = new LeaderResignedError()
      expect(err.message).toBe('Leader resigned during call')
    })

    it('uses custom message when provided', () => {
      const err = new LeaderResignedError('custom message')
      expect(err.message).toBe('custom message')
    })
  })
})
