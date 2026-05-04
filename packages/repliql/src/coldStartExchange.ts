import { getCacheOutcome, makeOperationsRegistry, setCacheOutcome } from '@repliql/utils'
import { type Exchange, makeResult, type OperationResult } from '@urql/core'
import { filter, fromPromise, map, merge, mergeMap, pipe, tap } from 'wonka'

const DEFAULT_SWEEP_DELAY_MS = 120_000
const DEFAULT_FLUSH_DELAY_MS = 2_000
const DEFAULT_DIRECTORY = 'repliql-cold-start'

interface CachedEntry {
  data: unknown
  hasNext?: boolean
  stale?: boolean
}

interface ColdStartConfig {
  sweepDelayMs?: number
  flushDelayMs?: number
  directory?: string
}

export function coldStartExchange(config: ColdStartConfig = {}): Exchange {
  const sweepDelayMs = config.sweepDelayMs ?? DEFAULT_SWEEP_DELAY_MS
  const flushDelayMs = config.flushDelayMs ?? DEFAULT_FLUSH_DELAY_MS
  const directory = config.directory ?? DEFAULT_DIRECTORY

  const opfs = makeOpfsStore(directory)

  return ({ forward }) => {
    return operations$ => {
      let bypassed = false

      const pendingWrites = new Map<number, CachedEntry>()
      const pendingDeletes = new Set<number>()
      let flushTimer: ReturnType<typeof setTimeout> | undefined

      const registry = makeOperationsRegistry<boolean>({
        kinds: ['query'],
        eviction: { strategy: 'delayed', delayMs: sweepDelayMs },
        onAdd: op => {
          pendingDeletes.delete(op.key)
          return true
        },
        onEvict: key => {
          pendingWrites.delete(key)
          enqueueDelete(key)
        },
      })

      function enqueueWrite(key: number, entry: CachedEntry) {
        pendingWrites.set(key, entry)
        flushTimer ??= setTimeout(flush, flushDelayMs)
      }

      function enqueueDelete(key: number) {
        pendingDeletes.add(key)
        flushTimer ??= setTimeout(flush, flushDelayMs)
      }

      async function flush() {
        flushTimer = undefined

        const writeBatch = [...pendingWrites]
        pendingWrites.clear()

        await Promise.all(
          writeBatch.map(([key, entry]) => {
            if (!registry.has(key)) return
            return opfs.write(key, entry)
          }),
        )

        const deleteBatch = [...pendingDeletes]
        pendingDeletes.clear()

        await Promise.all(
          deleteBatch.map(key => {
            if (registry.has(key)) return
            return opfs.remove(key)
          }),
        )
      }

      let sweepScheduled = false
      function scheduleSweep() {
        if (sweepScheduled) return
        sweepScheduled = true
        setTimeout(() => {
          void opfs.sweep(key => registry.has(key))
        }, sweepDelayMs)
      }

      const cachedResults = pipe(
        operations$,
        tap(registry.spy),
        filter(
          op => !bypassed && op.kind === 'query' && op.context.requestPolicy !== 'network-only',
        ),
        mergeMap(op =>
          pipe(
            fromPromise(opfs.read(op.key)),
            map(entry => {
              if (!entry) return undefined
              const result = setCacheOutcome(
                makeResult(op, {
                  data: entry.data as Record<string, unknown>,
                  hasNext: entry.hasNext,
                }),
                'hit',
              )
              result.stale = entry.stale ?? false
              return result
            }),
          ),
        ),
        filter((r): r is OperationResult => !!r),
      )

      const forwardedResults = pipe(
        operations$,
        forward,
        tap(result => {
          if (!bypassed && getCacheOutcome(result) === 'hit') {
            bypassed = true
            scheduleSweep()
          }

          if (result.operation.kind !== 'query' || result.error || !result.data) {
            return
          }

          const entry: CachedEntry = {
            data: result.data,
            hasNext: result.hasNext,
            stale: result.stale,
          }
          enqueueWrite(result.operation.key, entry)
        }),
      )

      return merge([forwardedResults, cachedResults])
    }
  }
}

interface OpfsStore {
  read: (key: number) => Promise<CachedEntry | undefined>
  write: (key: number, entry: CachedEntry) => Promise<void>
  remove: (key: number) => Promise<void>
  sweep: (isLive: (key: number) => boolean) => Promise<void>
}

interface OpfsFileHandle {
  getFile: () => Promise<{ text: () => Promise<string> }>
  createWritable: () => Promise<{
    write: (data: string) => Promise<void>
    close: () => Promise<void>
  }>
}

interface OpfsDirHandle {
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<OpfsFileHandle>
  getDirectoryHandle: (name: string, options?: { create?: boolean }) => Promise<OpfsDirHandle>
  removeEntry: (name: string) => Promise<void>
  entries: () => AsyncIterableIterator<[string, unknown]>
}

interface NavigatorWithStorage {
  storage?: { getDirectory?: () => Promise<OpfsDirHandle> }
}

function makeOpfsStore(directory: string): OpfsStore {
  const nav: NavigatorWithStorage | undefined =
    typeof navigator !== 'undefined' ? (navigator as NavigatorWithStorage) : undefined
  const getDirectory = nav?.storage?.getDirectory?.bind(nav.storage)

  if (!getDirectory) {
    return {
      read: async () => undefined,
      write: async () => {},
      remove: async () => {},
      sweep: async () => {},
    }
  }

  let dirPromise: Promise<OpfsDirHandle> | undefined
  function getDir() {
    dirPromise ??= getDirectory!().then(root =>
      root.getDirectoryHandle(directory, { create: true }),
    )
    return dirPromise
  }

  const fileName = (key: number) => `${key}.json`

  return {
    async read(key) {
      try {
        const dir = await getDir()
        const handle = await dir.getFileHandle(fileName(key))
        const file = await handle.getFile()
        const text = await file.text()
        return JSON.parse(text) as CachedEntry
      } catch {
        return undefined
      }
    },
    async write(key, entry) {
      try {
        const dir = await getDir()
        const handle = await dir.getFileHandle(fileName(key), { create: true })
        const writable = await handle.createWritable()
        await writable.write(JSON.stringify(entry))
        await writable.close()
      } catch (error) {
        console.error('coldStartExchange: failed to write', key, error)
      }
    },
    async remove(key) {
      try {
        const dir = await getDir()
        await dir.removeEntry(fileName(key))
      } catch {
        // ignore
      }
    },
    async sweep(isLive) {
      try {
        const dir = await getDir()
        for await (const [name] of dir.entries()) {
          const match = /^(\d+)\.json$/.exec(name)
          if (!match) continue
          const key = Number(match[1])
          if (!isLive(key)) {
            await dir.removeEntry(name).catch(() => {})
          }
        }
      } catch (error) {
        console.error('coldStartExchange: sweep failed', error)
      }
    },
  }
}
