export class UnknownConnectionError extends Error {
  override name = 'UnknownConnectionError'

  constructor(connectionId: string) {
    super(`@repliql/kysely-driver-bridge: unknown connection "${connectionId}"`)
  }
}

export function isErrorWithName(err: unknown, name: string): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: unknown }).name === name
}
