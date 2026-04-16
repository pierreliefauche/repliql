import fastStableStringify from '@solana/fast-stable-stringify'

export function stableStringify(val: unknown): string {
  return fastStableStringify(val)
}
