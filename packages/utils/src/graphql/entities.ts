export interface Entity<T extends string = string> {
  __typename: T
  id: string
  [key: string]: unknown
}

export type EntityRef<T extends string = string> = `${T}:${string}`

export type EntityPointer<T extends string = string> = {
  __ref: EntityRef<T>
}

export type EntityHandle<T extends string = string> = Entity<T> | EntityPointer<T> | EntityRef<T>

export function decomposeEntityHandle(obj: unknown): Entity | undefined {
  if (isEntity(obj)) {
    return obj
  } else if (isEntityRef(obj)) {
    return parseEntityRef(obj)
  } else if (isEntityPointer(obj)) {
    return parseEntityRef(obj.__ref)
  }
  return undefined
}

export function getEntityTypename<T extends string>(obj: EntityHandle<T>): T | undefined {
  if (isEntity(obj)) {
    return obj.__typename
  } else if (isEntityRef(obj)) {
    return parseEntityRef(obj)?.__typename
  } else {
    obj satisfies EntityPointer<T>
    return parseEntityRef(obj.__ref)?.__typename
  }
}

function buildEntityRef<T extends string>(obj: Entity<T>): EntityRef<T> {
  return `${obj.__typename}:${obj.id}`
}

export function getEntityRef<T extends string>(obj: EntityHandle<T>): EntityRef<T> {
  if (isEntity(obj)) {
    return buildEntityRef(obj)
  } else if (isEntityRef(obj)) {
    return obj
  } else {
    obj satisfies EntityPointer<T>
    return obj.__ref
  }
}

export function parseEntityRef<T extends string>(
  ref: EntityRef<T>,
): undefined | Pick<Entity<T>, '__typename' | 'id'> {
  const [__typename, ...idParts] = ref.split(':') as [T, ...string[]]
  const id = idParts.join(':')
  if (__typename && id) {
    return { __typename, id }
  }
  return undefined
}

export function getEntityPointer<T extends string>(obj: EntityHandle<T>): EntityPointer<T> {
  if (isEntity(obj)) {
    return { __ref: buildEntityRef(obj) }
  } else if (isEntityRef(obj)) {
    return { __ref: obj }
  } else {
    obj satisfies EntityPointer<T>
    return obj
  }
}

export function isEntityRef(data: unknown): data is EntityRef {
  return Boolean(typeof data === 'string' && parseEntityRef(data as EntityRef))
}

export function isEntity<T extends string>(data: unknown): data is Entity<T> {
  return Boolean(
    data &&
    typeof data === 'object' &&
    '__typename' in data &&
    typeof data.__typename === 'string' &&
    'id' in data &&
    typeof data.id === 'string',
  )
}

export function isEntityPointer(data: unknown): data is EntityPointer {
  return Boolean(data && typeof data === 'object' && '__ref' in data && isEntityRef(data.__ref))
}

export function isEntityHandle(data: unknown): data is EntityHandle {
  return isEntityPointer(data) || isEntity(data) || isEntityRef(data)
}
