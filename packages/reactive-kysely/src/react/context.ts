import { type Context, createContext, useContext } from 'react'

import type { ReactiveKysely } from '../ReactiveKysely'

const OBJ = {}

export const ReactiveKyselyContext: Context<ReactiveKysely | object> = createContext(OBJ)

export const ReactiveKyselyProvider = ReactiveKyselyContext.Provider

export function useReactiveKysely<DB = any>(override?: ReactiveKysely<DB>): ReactiveKysely<DB> {
  const kysely = useContext(ReactiveKyselyContext)

  if (override) {
    return override
  }

  if (kysely === OBJ && process.env.NODE_ENV !== 'production') {
    const error =
      "No Kysely client has been specified using ReactiveKysely's Provider. please create a client and add a Provider."

    console.error(error)
    throw new Error(error)
  }

  return kysely as ReactiveKysely<DB>
}
