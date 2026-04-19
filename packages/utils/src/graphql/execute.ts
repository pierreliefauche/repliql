import type {
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  InlineFragmentNode,
  OperationDefinitionNode,
  SelectionNode,
  SelectionSetNode,
  VariableDefinitionNode,
  DirectiveNode,
  ArgumentNode,
} from '@0no-co/graphql.web'
import { GraphQLError, valueFromASTUntyped } from '@0no-co/graphql.web'

import { Entity } from './entities'

export interface ResolveInfo {
  readonly rootOperation: 'query' | 'mutation'
  readonly fieldName: string
  readonly alias?: string
  readonly path: readonly (string | number)[]
}

export type FieldResolver<TSource extends Entity, TContext, TArgs = any, TResult = unknown> = (
  source: TSource | undefined,
  args: TArgs,
  context: TContext,
  info: ResolveInfo,
) => TResult | Promise<TResult>

export interface CompiledOperation {
  readonly rootOperation: 'query' | 'mutation'
  readonly variableDefinitions: ReadonlyArray<VariableDefinitionNode>
  readonly selectionSet: SelectionSetNode
}

export interface DocumentExecuteOptions<TContext> {
  document: DocumentNode
  operationName?: string
  context: TContext
  fieldResolver: FieldResolver<any, TContext>
  variableValues?: Record<string, unknown>
}

export interface CompiledExecuteOptions<TContext> {
  compiled: CompiledOperation
  context: TContext
  fieldResolver: FieldResolver<any, TContext>
  variableValues?: Record<string, unknown>
}

export type ExecuteOptions<TContext> =
  | DocumentExecuteOptions<TContext>
  | CompiledExecuteOptions<TContext>

export interface ExecutionResult {
  data?: Record<string, unknown> | null
  errors?: ReadonlyArray<GraphQLError>
}

export function compile(document: DocumentNode, operationName?: string): CompiledOperation {
  let operation: OperationDefinitionNode | undefined
  const fragments = new Map<string, FragmentDefinitionNode>()

  for (const def of document.definitions) {
    if (def.kind === 'OperationDefinition') {
      if (operationName) {
        if (def.name?.value === operationName) operation = def
      } else if (operation) {
        throw new GraphQLError(
          'Must provide operationName if the document contains multiple operations.',
        )
      } else {
        operation = def
      }
    } else if (def.kind === 'FragmentDefinition') {
      fragments.set(def.name.value, def)
    }
  }

  if (!operation) {
    throw new GraphQLError(
      operationName
        ? `Unknown operation named "${operationName}".`
        : 'Must provide an operation.',
    )
  }

  if (operation.operation === 'subscription') {
    throw new GraphQLError('Subscriptions are not supported by this executor.')
  }

  const selectionSet = flattenSelectionSet(operation.selectionSet, fragments, new Set())

  return {
    rootOperation: operation.operation as 'query' | 'mutation',
    variableDefinitions: operation.variableDefinitions ?? [],
    selectionSet,
  }
}

function flattenSelectionSet(
  selectionSet: SelectionSetNode,
  fragments: Map<string, FragmentDefinitionNode>,
  inProgress: Set<string>,
): SelectionSetNode {
  const selections: SelectionNode[] = []
  for (const sel of selectionSet.selections) {
    if (sel.kind === 'Field') {
      selections.push(
        sel.selectionSet
          ? { ...sel, selectionSet: flattenSelectionSet(sel.selectionSet, fragments, inProgress) }
          : sel,
      )
    } else if (sel.kind === 'InlineFragment') {
      selections.push({
        ...sel,
        selectionSet: flattenSelectionSet(sel.selectionSet, fragments, inProgress),
      })
    } else {
      const name = sel.name.value
      if (inProgress.has(name)) {
        throw new GraphQLError(`Cannot spread fragment "${name}" within itself.`)
      }
      const frag = fragments.get(name)
      if (!frag) {
        throw new GraphQLError(`Unknown fragment "${name}".`)
      }
      inProgress.add(name)
      const inlined = flattenSelectionSet(frag.selectionSet, fragments, inProgress)
      inProgress.delete(name)

      const directives =
        sel.directives && frag.directives
          ? [...sel.directives, ...frag.directives]
          : (sel.directives ?? frag.directives)

      const wrapper: InlineFragmentNode = {
        kind: 'InlineFragment' as InlineFragmentNode['kind'],
        typeCondition: frag.typeCondition,
        directives,
        selectionSet: inlined,
      }
      selections.push(wrapper)
    }
  }
  return {
    kind: 'SelectionSet' as SelectionSetNode['kind'],
    selections,
  }
}

export async function execute<TContext>(
  options: ExecuteOptions<TContext>,
): Promise<ExecutionResult> {
  let compiled: CompiledOperation
  if ('compiled' in options) {
    compiled = options.compiled
  } else {
    try {
      compiled = compile(options.document, options.operationName)
    } catch (err) {
      return {
        errors: [err instanceof GraphQLError ? err : new GraphQLError((err as Error).message)],
      }
    }
  }

  const { context, fieldResolver, variableValues } = options
  const { rootOperation, variableDefinitions, selectionSet: rootSelectionSet } = compiled

  let variables: Record<string, unknown>
  try {
    variables = coerceVariables(variableDefinitions, variableValues)
  } catch (err) {
    return {
      errors: [err instanceof GraphQLError ? err : new GraphQLError((err as Error).message)],
    }
  }

  const errors: GraphQLError[] = []

  const data = await executeSelectionSet(
    undefined,
    rootSelectionSet,
    [],
    rootOperation === 'mutation',
  )

  return errors.length ? { data, errors } : { data }

  function directivesPass(directives: ReadonlyArray<DirectiveNode> | undefined): boolean {
    if (!directives) return true
    for (const dir of directives) {
      const name = dir.name.value
      if (name !== 'skip' && name !== 'include') continue
      const ifArg = dir.arguments?.find(a => a.name.value === 'if')
      if (!ifArg) continue
      const value = valueFromASTUntyped(ifArg.value, variables)
      if (name === 'skip' && value === true) return false
      if (name === 'include' && value === false) return false
    }
    return true
  }

  function collectFields(
    selectionSet: SelectionSetNode,
    groups: Map<string, FieldNode[]>,
  ): void {
    for (const sel of selectionSet.selections) {
      if (!directivesPass(sel.directives)) continue
      if (sel.kind === 'Field') {
        const key = sel.alias?.value ?? sel.name.value
        let list = groups.get(key)
        if (!list) {
          list = []
          groups.set(key, list)
        }
        list.push(sel)
      } else if (sel.kind === 'InlineFragment') {
        collectFields(sel.selectionSet, groups)
      }
      // FragmentSpread nodes have already been flattened away by compile().
    }
  }

  async function executeSelectionSet(
    source: unknown,
    selectionSet: SelectionSetNode,
    path: readonly (string | number)[],
    serial: boolean,
  ): Promise<Record<string, unknown>> {
    const groups = new Map<string, FieldNode[]>()
    collectFields(selectionSet, groups)

    const result: Record<string, unknown> = {}

    if (serial) {
      for (const [key, fieldNodes] of groups) {
        result[key] = await executeField(source, fieldNodes, path.concat(key))
      }
    } else {
      const keys: string[] = []
      const promises: Array<Promise<unknown>> = []
      for (const [key, fieldNodes] of groups) {
        keys.push(key)
        promises.push(executeField(source, fieldNodes, path.concat(key)))
      }
      const resolved = await Promise.all(promises)
      for (let i = 0; i < keys.length; i++) result[keys[i]!] = resolved[i]
    }

    return result
  }

  function buildArgs(fieldNode: FieldNode): Record<string, unknown> {
    const args: Record<string, unknown> = {}
    if (!fieldNode.arguments) return args
    for (const arg of fieldNode.arguments as ReadonlyArray<ArgumentNode>) {
      args[arg.name.value] = valueFromASTUntyped(arg.value, variables)
    }
    return args
  }

  async function executeField(
    source: unknown,
    fieldNodes: FieldNode[],
    path: readonly (string | number)[],
  ): Promise<unknown> {
    const fieldNode = fieldNodes[0]!
    const fieldName = fieldNode.name.value
    const alias = fieldNode.alias?.value
    const args = buildArgs(fieldNode)
    const info: ResolveInfo = { rootOperation, fieldName, alias, path }

    let resolved: unknown
    try {
      resolved = fieldResolver(source, args, context, info)
      if (resolved && typeof (resolved as Promise<unknown>).then === 'function') {
        resolved = await resolved
      }
    } catch (rawErr) {
      errors.push(toGraphQLError(rawErr, fieldNode, path))
      return null
    }

    const subSelectionSet = mergeSelectionSets(fieldNodes)
    try {
      return await completeValue(resolved, subSelectionSet, path)
    } catch (rawErr) {
      errors.push(toGraphQLError(rawErr, fieldNode, path))
      return null
    }
  }

  async function completeValue(
    value: unknown,
    subSelectionSet: SelectionSetNode | undefined,
    path: readonly (string | number)[],
  ): Promise<unknown> {
    if (value == null) return null

    if (Array.isArray(value)) {
      const items: Array<Promise<unknown>> = []
      for (let i = 0; i < value.length; i++) {
        items.push(completeItem(value[i], subSelectionSet, path, i))
      }
      return Promise.all(items)
    }

    if (subSelectionSet) {
      return executeSelectionSet(value, subSelectionSet, path, false)
    }

    return value
  }

  async function completeItem(
    item: unknown,
    subSelectionSet: SelectionSetNode | undefined,
    path: readonly (string | number)[],
    index: number,
  ): Promise<unknown> {
    const itemPath = path.concat(index)
    try {
      const awaited =
        item && typeof (item as Promise<unknown>).then === 'function' ? await item : item
      return await completeValue(awaited, subSelectionSet, itemPath)
    } catch (rawErr) {
      errors.push(toGraphQLError(rawErr, undefined, itemPath))
      return null
    }
  }
}

function coerceVariables(
  variableDefinitions: ReadonlyArray<VariableDefinitionNode>,
  provided: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const varDef of variableDefinitions) {
    const name = varDef.variable.name.value
    if (provided && name in provided) {
      out[name] = provided[name]
    } else if (varDef.defaultValue) {
      out[name] = valueFromASTUntyped(varDef.defaultValue)
    } else if (varDef.type.kind === 'NonNullType') {
      throw new GraphQLError(`Variable "$${name}" of required type was not provided.`, varDef)
    }
  }
  return out
}

function mergeSelectionSets(fieldNodes: FieldNode[]): SelectionSetNode | undefined {
  let merged: SelectionSetNode | undefined
  for (const node of fieldNodes) {
    if (!node.selectionSet) continue
    if (!merged) {
      merged = node.selectionSet
    } else {
      merged = {
        kind: merged.kind,
        selections: [...merged.selections, ...node.selectionSet.selections],
      }
    }
  }
  return merged
}

function toGraphQLError(
  err: unknown,
  node: FieldNode | undefined,
  path: readonly (string | number)[],
): GraphQLError {
  if (err instanceof GraphQLError) {
    if (err.path) return err
    return new GraphQLError(
      err.message,
      node ?? null,
      undefined,
      undefined,
      path,
      err.originalError ?? err,
      err.extensions,
    )
  }
  const asError = err instanceof Error ? err : new Error(String(err))
  return new GraphQLError(asError.message, node ?? null, undefined, undefined, path, asError)
}
