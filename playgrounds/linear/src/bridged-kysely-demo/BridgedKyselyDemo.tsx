import { BridgedDriver, type DriverBridgeRemote } from '@repliql/kysely-driver-bridge/shared'
import { Kysely, sql, SqliteAdapter, SqliteIntrospector, SqliteQueryCompiler } from 'kysely'
import { useEffect, useState } from 'react'

import { sharedServices } from '../lib/sharedServices'

interface Handle {
  db: Kysely<any>
}

let cached: Handle | null = null

function getHandle(): Handle {
  if (cached) {
    return cached
  }

  const db = new Kysely({
    dialect: {
      createDriver: () =>
        new BridgedDriver(sharedServices.kyselyDriverBridge as DriverBridgeRemote),
      createAdapter: () => new SqliteAdapter(),
      createIntrospector: db => new SqliteIntrospector(db),
      createQueryCompiler: () => new SqliteQueryCompiler(),
    },
  })

  cached = {
    db,
  }

  return cached
}

export function BridgedKyselyDemo() {
  const [db, setDb] = useState<Kysely<any>>()
  const [query, setQuery] = useState<string>('SELECT * FROM sqlite_master')
  const [results, setResults] = useState<Record<string, unknown>[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const handle = getHandle()
    setDb(handle.db)
  }, [])

  const executeQuery = async () => {
    if (!db || !query.trim()) return

    setIsLoading(true)
    setError(null)
    setResults([])

    try {
      const result = await sql.raw(query).execute(db)
      setResults(result.rows as Record<string, unknown>[])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }

  const columns = results.length > 0 ? Object.keys(results[0]) : []

  return (
    <div
      style={{
        padding: 32,
        maxWidth: 900,
        margin: '40px auto',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ marginTop: 0 }}>Bridged Kysely demo</h1>
      <p style={{ color: '#666', lineHeight: 1.5 }}>
        SQLite is running in tabs' dedicated workers. A single dedicated worker is actively
        interacting with SQLite with a shared worker as broker to elect leader. Queries from tab
        flow through shared worker to the elected dedicated worker.
      </p>

      <div style={{ marginTop: 24 }}>
        <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>SQL Query</label>
        <textarea
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              executeQuery()
            }
          }}
          placeholder="Enter SQL query..."
          style={{
            width: '100%',
            minHeight: 120,
            padding: 12,
            fontSize: 14,
            fontFamily: 'ui-monospace, monospace',
            border: '1px solid #ccc',
            borderRadius: 6,
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
        <button
          onClick={executeQuery}
          disabled={!db || isLoading}
          style={{
            marginTop: 12,
            padding: '10px 20px',
            fontSize: 14,
            fontWeight: 500,
            backgroundColor: db && !isLoading ? '#0066cc' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: db && !isLoading ? 'pointer' : 'not-allowed',
          }}
        >
          {isLoading ? 'Executing...' : 'Execute'}
        </button>
        <span style={{ marginLeft: 12, color: '#888', fontSize: 12 }}>⌘+Enter</span>
      </div>

      {error && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            borderRadius: 6,
            color: '#c00',
            fontSize: 14,
            fontFamily: 'ui-monospace, monospace',
            whiteSpace: 'pre-wrap',
          }}
        >
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ margin: '0 0 12px 0' }}>
            Results ({results.length} row{results.length !== 1 ? 's' : ''})
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 13,
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              <thead>
                <tr>
                  {columns.map(col => (
                    <th
                      key={col}
                      style={{
                        textAlign: 'left',
                        padding: '8px 12px',
                        backgroundColor: '#f5f5f5',
                        borderBottom: '2px solid #ddd',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((row, i) => (
                  <tr key={i}>
                    {columns.map(col => (
                      <td
                        key={col}
                        style={{
                          padding: '8px 12px',
                          borderBottom: '1px solid #eee',
                          maxWidth: 300,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={format(row[col])}
                      >
                        {row[col] === null ? (
                          <span style={{ color: '#999', fontStyle: 'italic' }}>NULL</span>
                        ) : (
                          String(row[col])
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!error && results.length === 0 && !isLoading && (
        <p style={{ marginTop: 24, color: '#888', fontSize: 14 }}>
          No results yet. Enter a query and click Execute.
        </p>
      )}
    </div>
  )
}

function format(data: unknown): string {
  if (typeof data !== 'string') {
    return JSON.stringify(data, null, 2)
  }
  try {
    return JSON.stringify(JSON.parse(data), null, 2)
  } catch {
    return String(data)
  }
}
