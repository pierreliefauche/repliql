import {
  wrapSharedServices,
  type SharedServicesConnector,
  type RemoteServices,
} from '@repliql/shared-service/tab'
import * as Comlink from 'comlink'
import { useEffect, useState } from 'react'

import type { SharedServiceMap } from './types'

interface Handle {
  services: RemoteServices<SharedServiceMap>
}

let cached: Handle | null = null

function getHandle(): Handle {
  if (cached) return cached

  const sharedWorker = new SharedWorker(new URL('./shared.worker.ts', import.meta.url), {
    type: 'module',
    name: 'shared-service-demo',
  })

  const managerConnector = Comlink.wrap<SharedServicesConnector>(sharedWorker.port)
  const services = wrapSharedServices<SharedServiceMap>(managerConnector, {
    logger: {
      ...console,
      level: 'debug',
    },
  })

  cached = {
    services,
  }
  return cached
}

interface State {
  count: number | null
  online: string[]
  me: string | null
}

const empty: State = { count: null, online: [], me: null }

export function SharedServiceDemo() {
  const [state, setState] = useState<State>(empty)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void refresh()
    const id = setInterval(() => void refresh(), 1500)
    return () => clearInterval(id)
  }, [])

  async function refresh() {
    setError(null)
    try {
      const { services } = getHandle()
      const [count, online, me] = await Promise.all([
        services.counter.get(),
        services.presence.list(),
        services.presence.whoAmI(),
      ])
      setState({ count, online, me })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function bump() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const { services } = getHandle()
      await services.counter.inc()
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        padding: 32,
        maxWidth: 720,
        margin: '40px auto',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ marginTop: 0 }}>Shared service demo</h1>
      <p style={{ color: '#666', lineHeight: 1.5 }}>
        Open this page in several tabs. The shared worker hosts a <code>SharedServicesManager</code>{' '}
        with two services: a per-tab <code>counter</code> and a global <code>presence</code>{' '}
        registry. The counter is bound to <em>your</em> tab — bumping it in one tab does not affect
        another. The presence list is shared, and tabs come and go from it as their heartbeats start
        and stop.
      </p>
      <p style={{ color: '#888', fontSize: 13 }}>
        this tab id: <code>{state.me ?? '…'}</code>
      </p>

      <div style={{ display: 'flex', gap: 8, marginBlock: 24 }}>
        <button onClick={bump} disabled={busy}>
          bump my counter
        </button>
        <button onClick={refresh} disabled={busy} style={{ marginLeft: 'auto' }}>
          refresh
        </button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          <tr style={{ borderTop: '1px solid #eee' }}>
            <td style={{ padding: '12px 0', color: '#666' }}>my counter (per-tab)</td>
            <td
              style={{
                padding: '12px 0',
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <strong>{state.count ?? '…'}</strong>
            </td>
          </tr>
          <tr style={{ borderTop: '1px solid #eee' }}>
            <td style={{ padding: '12px 0', color: '#666' }}>online tabs (shared)</td>
            <td style={{ padding: '12px 0', textAlign: 'right' }}>
              <strong>{state.online.length}</strong>
            </td>
          </tr>
        </tbody>
      </table>

      <ul style={{ marginTop: 16, paddingLeft: 20, color: '#444', fontSize: 13 }}>
        {state.online.map(id => (
          <li key={id}>
            <code>{id}</code>
            {id === state.me ? ' (you)' : ''}
          </li>
        ))}
      </ul>

      {error && (
        <p style={{ color: '#c00', marginTop: 16 }}>
          error: <code>{error}</code>
        </p>
      )}
    </div>
  )
}
