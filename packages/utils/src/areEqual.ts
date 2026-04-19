import { isPrimitive } from './primitives'
import { stableStringify } from './stableStringify'

export function areEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true
  }

  if (a == null && b == null) {
    // We consider undefined and null to be "equal"
    return true
  }

  if (isPrimitive(a) || isPrimitive(b)) {
    // One of the values is a primitive, so equality would
    // have been caught by strict equality above
    return false
  }

  // Comparing non primitives
  return stableStringify(a) === stableStringify(b)
}
