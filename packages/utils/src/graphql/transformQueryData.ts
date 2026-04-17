import type { AnyVariables } from '@urql/core'
import type { DocumentNode, FieldNode, OperationDefinitionNode, ValueNode } from 'graphql'

import { type Entity, isEntity } from './entities'

type GetFieldName = (args: {
  name: string
  alias?: string
  args?: Record<string, unknown>
}) => string

function getFieldArgumentValue(node: ValueNode, variables: AnyVariables): unknown {
  switch (node.kind) {
    case 'Variable':
      return variables?.[node.name.value]
    case 'IntValue':
      return parseInt(node.value, 10)
    case 'FloatValue':
      return parseFloat(node.value)
    case 'StringValue':
      return node.value
    case 'BooleanValue':
      return node.value
    case 'NullValue':
      return null
    case 'EnumValue':
      return node.value
    case 'ListValue':
      return node.values.map(node => getFieldArgumentValue(node, variables))
    case 'ObjectValue':
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
        for (const sel of node.selectionSet.selections) {
          if (sel.kind !== 'Field') continue
          transformed[fieldKey(sel)] = transformNode(sel, value[sel.name.value])
        }
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
