import { describe, it, expect } from 'bun:test'

import { isDedicatedPortMessage, LeaderResignedError, CONDUIT_DEDICATED_PORT } from './protocol'

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

  describe('LeaderResignedError', () => {
    it('exposes a stable name', () => {
      const err = new LeaderResignedError()
      expect(err.name).toBe('LeaderResignedError')
      expect(err).toBeInstanceOf(Error)
    })
  })
})
