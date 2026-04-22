import { stableStringify } from '@repliql/utils'
import { useEffect, useMemo, useState } from 'react'
import { pipe, subscribe } from 'wonka'

import { ReactiveKysely } from '../ReactiveKysely'

import { useReactiveKysely } from './context'

export function makeUseLiveSelect<DB>() {
  return function useLiveSelect<
    Q extends ReturnType<ReactiveKysely<DB>['selectFrom']>,
    Result = Awaited<ReturnType<Q['execute']>>[number],
  >(
    query: Q | ((db: ReactiveKysely<DB>) => Q),
    options?: { debounceMs?: number; db?: ReactiveKysely<DB> },
  ): Result[] | undefined {
    const { debounceMs } = options || {}

    const db = useReactiveKysely<DB>(options?.db)

    const { selectQuery, queryKey } = useMemo(() => {
      const selectQuery = typeof query === 'function' ? query(db) : query
      const compiled = selectQuery.compile()
      const queryKey = stableStringify([compiled.sql, compiled.parameters])

      return { selectQuery, queryKey }
    }, [query])

    const [data, setData] = useState<Result[] | undefined>(undefined)

    useEffect(() => {
      setData(undefined)

      const source = db.liveQuery<Q, Result>(selectQuery, { debounceMs })
      const subscription = pipe(
        source,
        subscribe(next => setData(next)),
      )

      return () => subscription.unsubscribe()
      // selectQuery is re-derived from db + queryKey; depending on the derived
      // value would retrigger the effect every render.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db, queryKey, debounceMs])

    return data
  }
}
