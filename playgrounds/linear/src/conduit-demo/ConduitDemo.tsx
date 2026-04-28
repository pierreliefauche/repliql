import { createConduit } from '@repliql/conduit/tab'
import type { Remote } from '@repliql/conduit/tab'
import { useEffect, useState } from 'react'

import type { CounterService } from './types'

interface Handle {
  service: Remote<CounterService>
  tabId: string
}

let cached: Handle | null = null

function getHandle(): Handle {
  if (cached) {
    return cached
  }

  const dedicated = new Worker(new URL('./dedicated.worker.ts', import.meta.url), {
    type: 'module',
    name: 'conduit-demo-dedicated',
  })

  const shared = new SharedWorker(new URL('./shared.worker.ts', import.meta.url), {
    type: 'module',
    name: 'conduit-demo-shared',
  })

  const { tabId, consumeFromSharedWorker } = createConduit({ dedicated, shared })

  cached = {
    service: consumeFromSharedWorker<CounterService>(),
    tabId,
  }

  return cached
}

interface State {
  value: number | null
  square: number | null
  abs: number | null
}

const empty: State = { value: null, square: null, abs: null }

export function ConduitDemo() {
  const [state, setState] = useState<State>(empty)
  const [tabId, setTabId] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handle = getHandle()
    setTabId(handle.tabId)
    void refresh()
  }, [])

  async function refresh() {
    setError(null)
    try {
      const { service } = getHandle()
      const [value, square, abs] = await Promise.all([
        service.getValue(),
        service.getSquare(),
        service.getAbs(),
      ])
      setState({ value, square, abs })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function step(delta: number) {
    if (busy) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      const { service } = getHandle()
      await service.increment(delta)
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
        maxWidth: 640,
        margin: '40px auto',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ marginTop: 0 }}>Conduit demo</h1>
      <p style={{ color: '#666', lineHeight: 1.5 }}>
        Open this page in several tabs. The shared worker holds a single counter; only the elected
        tab&apos;s dedicated worker computes <code>square</code>/<code>abs</code>. Closing the
        leader tab promotes the next one — the counter survives, and the next call routes to the new
        dedicated worker. Watch the shared worker console for leader election events.
      </p>
      <p style={{ color: '#888', fontSize: 13 }}>
        this tab id: <code>{tabId}</code>
      </p>

      <div style={{ display: 'flex', gap: 8, marginBlock: 24 }}>
        <button onClick={() => step(1)} disabled={busy}>
          +1
        </button>
        <button onClick={() => step(-1)} disabled={busy}>
          −1
        </button>
        <button onClick={() => step(5)} disabled={busy}>
          +5
        </button>
        <button onClick={() => step(-10)} disabled={busy}>
          −10
        </button>
        <button onClick={refresh} disabled={busy} style={{ marginLeft: 'auto' }}>
          refresh
        </button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          <Row label="value" value={state.value} />
          <Row label="square" value={state.square} />
          <Row label="abs" value={state.abs} />
        </tbody>
      </table>

      {error && (
        <p style={{ color: '#c00', marginTop: 16 }}>
          error: <code>{error}</code>
        </p>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: number | null }) {
  return (
    <tr style={{ borderTop: '1px solid #eee' }}>
      <td style={{ padding: '12px 0', color: '#666' }}>{label}</td>
      <td style={{ padding: '12px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        <strong>{value ?? '…'}</strong>
      </td>
    </tr>
  )
}
