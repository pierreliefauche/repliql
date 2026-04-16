export type Primitive = string | number | boolean | null | undefined

const primitiveTypes = new Set<string>([typeof 'string', typeof 42, typeof true, typeof undefined])

export function isPrimitive(v: unknown): v is Primitive {
  if (v == null) {
    return true
  }

  const type = typeof v

  if (!primitiveTypes.has(type)) {
    return false
  }

  if (type === 'number' && !Number.isFinite(v as number)) {
    return false
  }

  return true
}
