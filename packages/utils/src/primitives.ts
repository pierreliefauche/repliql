export type Primitive = string | number | boolean | null | undefined

const primitiveTypes = new Set<string>([typeof 'string', typeof 42, typeof true, typeof undefined])

export function isPrimitive(v: unknown): v is Primitive {
  return v == null || primitiveTypes.has(typeof v)
}
