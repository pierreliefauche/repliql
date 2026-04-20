import { Kind } from '@0no-co/graphql.web'
import type { AnyVariables } from '@urql/core'
import type {
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
  SelectionSetNode,
  ValueNode,
} from 'graphql'

import { type Entity, isEntity } from './entities'

type GetFieldName = (args: {
  name: string
  alias?: string
  args?: Record<string, unknown>
}) => string

function getFieldArgumentValue(node: ValueNode, variables: AnyVariables): unknown {
  switch (node.kind) {
    case Kind.VARIABLE:
      return variables?.[node.name.value]
    case Kind.INT:
      return parseInt(node.value, 10)
    case Kind.FLOAT:
      return parseFloat(node.value)
    case Kind.STRING:
      return node.value
    case Kind.BOOLEAN:
      return node.value
    case Kind.NULL:
      return null
    case Kind.ENUM:
      return node.value
    case Kind.LIST:
      return node.values.map(node => getFieldArgumentValue(node, variables))
    case Kind.OBJECT:
      return Object.fromEntries(
        node.fields.map(({ name, value }) => [name.value, getFieldArgumentValue(value, variables)]),
      )
    default:
      node satisfies never
      return undefined
  }
}

interface TransformOptions<Data = any> {
  query: DocumentNode
  data: Data
  variables: AnyVariables
  getFieldName: GetFieldName
}

type Transformed<T> = null | T | T[] | Transformed<T>[]

export function transformQueryData<T, Output = any, Data = any>(
  { query, data, variables = {}, getFieldName }: TransformOptions<Data>,
  replacer: (entity: Entity) => T,
): Output {
  // Build a map of fragment definitions for lookups
  const fragments = new Map<string, FragmentDefinitionNode>()
  for (const def of query.definitions) {
    if (def.kind === Kind.FRAGMENT_DEFINITION) {
      fragments.set(def.name.value, def)
    }
  }

  function fieldKey(field: FieldNode): string {
    const args = field.arguments?.length
      ? Object.fromEntries(
          field.arguments.map(({ name, value }) => [
            name.value,
            getFieldArgumentValue(value, variables),
          ]),
        )
      : undefined
    return getFieldName({
      name: field.name.value,
      alias: field.alias?.value,
      args,
    })
  }

  function processSelectionSet(
    selectionSet: SelectionSetNode,
    value: any,
    transformed: Record<string, unknown>,
  ): void {
    for (const sel of selectionSet.selections) {
      switch (sel.kind) {
        case Kind.FIELD: {
          // GraphQL responses use alias as key when present
          const responseKey = sel.alias?.value ?? sel.name.value
          transformed[fieldKey(sel)] = transformNode(sel, value[responseKey])
          break
        }
        case Kind.FRAGMENT_SPREAD: {
          const fragment = fragments.get(sel.name.value)
          if (fragment?.selectionSet) {
            processSelectionSet(fragment.selectionSet, value, transformed)
          }
          break
        }
        case Kind.INLINE_FRAGMENT:
          if (sel.selectionSet) {
            processSelectionSet(sel.selectionSet, value, transformed)
          }
          break
      }
    }
  }

  function transformNode(node: OperationDefinitionNode | FieldNode, value: any): Transformed<T> {
    if (value == null) {
      return value
    }

    if (Array.isArray(value)) {
      return value.map(value => transformNode(node, value))
    }

    if (typeof value === 'object') {
      const transformed: any = {}

      if (node.selectionSet) {
        processSelectionSet(node.selectionSet, value, transformed)
      }

      // __typename might not be in the selection set
      if (value.__typename && !transformed.__typename) {
        transformed.__typename = value.__typename
      }

      return isEntity(transformed) ? replacer(transformed) : transformed
    }

    return value
  }

  const operation = query.definitions.find(
    (definition): definition is OperationDefinitionNode =>
      definition.kind === 'OperationDefinition',
  )
  if (!operation) throw new Error('No operation definition found')

  return transformNode(operation, data) as Output
}
