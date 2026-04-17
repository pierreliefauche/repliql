#!/usr/bin/env bun
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildSchema,
  getNamedType,
  Kind,
  parse,
  print,
  TypeInfo,
  visit,
  visitWithTypeInfo,
  type DefinitionNode,
  type DirectiveNode,
  type DocumentNode,
  type FieldDefinitionNode,
  type InputValueDefinitionNode,
  type InterfaceTypeDefinitionNode,
  type ObjectTypeDefinitionNode,
  type TypeNode,
} from 'graphql'

const here = dirname(fileURLToPath(import.meta.url))
const gqlDir = resolve(here, '../src/graphql')
const schemaPath = resolve(gqlDir, 'schema.graphql')
const queriesPath = resolve(gqlDir, 'queries.ts')
const outputPath = resolve(gqlDir, 'schema.subset.graphql')

const BUILT_IN_SCALARS = new Set(['String', 'Int', 'Float', 'Boolean', 'ID'])

// The Linear SDL dump has JS-style `\`` escapes inside deprecation reasons,
// which are not valid GraphQL string escapes. Unescape them before parsing.
const schemaSdl = readFileSync(schemaPath, 'utf8').replace(/\\`/g, '`')
const queriesSrc = readFileSync(queriesPath, 'utf8')

const schema = buildSchema(schemaSdl, { assumeValid: true })
const schemaDoc = parse(schemaSdl, { noLocation: true })

const gqlBlocks = extractGqlBlocks(queriesSrc)
if (gqlBlocks.length === 0) {
  console.error(`no gql\`...\` blocks found in ${queriesPath}`)
  process.exit(1)
}

const usedFields = new Map<string, Set<string>>()
const usedTypes = new Set<string>()
const fullyUsedTypes = new Set<string>()

for (const source of gqlBlocks) {
  const doc = parse(source)
  const typeInfo = new TypeInfo(schema)
  visit(
    doc,
    visitWithTypeInfo(typeInfo, {
      Field() {
        const parent = typeInfo.getParentType()
        const fieldDef = typeInfo.getFieldDef()
        if (!parent || !fieldDef) return
        addUsedField(parent.name, fieldDef.name)
        usedTypes.add(parent.name)
        usedTypes.add(getNamedType(fieldDef.type).name)
      },
      VariableDefinition(node) {
        markFully(baseTypeName(node.type))
      },
    }),
  )
}

const typeNodes = new Map<string, DefinitionNode>()
for (const def of schemaDoc.definitions) {
  if ('name' in def && def.name) typeNodes.set(def.name.value, def)
}

walkTypeDeps()

const outputDefs: DefinitionNode[] = []
for (const name of [...usedTypes].sort()) {
  const def = typeNodes.get(name)
  if (!def) continue

  if (def.kind === Kind.OBJECT_TYPE_DEFINITION || def.kind === Kind.INTERFACE_TYPE_DEFINITION) {
    const keep = usedFields.get(name)
    if (!keep || keep.size === 0) continue
    const fields = (def.fields ?? []).filter(f => keep.has(f.name.value)).map(cleanField)
    if (fields.length === 0) continue
    const cleaned: ObjectTypeDefinitionNode | InterfaceTypeDefinitionNode = {
      ...def,
      description: undefined,
      interfaces: [],
      directives: cleanDirectives(def.directives),
      fields,
    }
    outputDefs.push(cleaned)
    continue
  }

  if (def.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION) {
    outputDefs.push({
      ...def,
      description: undefined,
      directives: cleanDirectives(def.directives),
      fields: (def.fields ?? []).map(cleanInputValue),
    })
    continue
  }

  if (def.kind === Kind.ENUM_TYPE_DEFINITION) {
    outputDefs.push({
      ...def,
      description: undefined,
      directives: cleanDirectives(def.directives),
      values: (def.values ?? []).map(v => ({
        ...v,
        description: undefined,
        directives: cleanDirectives(v.directives),
      })),
    })
    continue
  }

  if (def.kind === Kind.UNION_TYPE_DEFINITION) {
    outputDefs.push({
      ...def,
      description: undefined,
      directives: cleanDirectives(def.directives),
    })
    continue
  }

  if (def.kind === Kind.SCALAR_TYPE_DEFINITION) {
    outputDefs.push({
      ...def,
      description: undefined,
      directives: cleanDirectives(def.directives),
    })
    continue
  }
}

const outputDoc: DocumentNode = { kind: Kind.DOCUMENT, definitions: outputDefs }
const outputSdl = print(outputDoc)

// Round-trip check: make sure the subset is a valid schema on its own.
try {
  buildSchema(outputSdl)
} catch (err) {
  console.error('generated subset failed to build:', err)
  process.exit(1)
}

writeFileSync(outputPath, outputSdl + '\n')

const stats = {
  originalLines: schemaSdl.split('\n').length,
  subsetLines: outputSdl.split('\n').length,
  types: outputDefs.length,
}
console.log(`wrote ${relative(process.cwd(), outputPath)}`)
console.log(`  ${stats.types} types kept, ${stats.subsetLines} lines (was ${stats.originalLines})`)

function extractGqlBlocks(src: string): string[] {
  const out: string[] = []
  const re = /\bgql`([\s\S]*?)`/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) out.push(m[1])
  return out
}

function addUsedField(typeName: string, fieldName: string) {
  let s = usedFields.get(typeName)
  if (!s) usedFields.set(typeName, (s = new Set()))
  s.add(fieldName)
}

function baseTypeName(t: TypeNode): string {
  let node = t
  while (node.kind === Kind.LIST_TYPE || node.kind === Kind.NON_NULL_TYPE) node = node.type
  return node.name.value
}

function markFully(name: string) {
  if (BUILT_IN_SCALARS.has(name)) return
  usedTypes.add(name)
  fullyUsedTypes.add(name)
}

function walkTypeDeps() {
  let changed = true
  while (changed) {
    changed = false
    for (const name of [...usedTypes]) {
      const def = typeNodes.get(name)
      if (!def) continue

      if (def.kind === Kind.OBJECT_TYPE_DEFINITION || def.kind === Kind.INTERFACE_TYPE_DEFINITION) {
        const fields = usedFields.get(name)
        if (!fields) continue
        for (const f of def.fields ?? []) {
          if (!fields.has(f.name.value)) continue
          if (addType(baseTypeName(f.type))) changed = true
          for (const arg of f.arguments ?? []) {
            if (markFullyReturn(baseTypeName(arg.type))) changed = true
          }
        }
        continue
      }

      if (def.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION) {
        if (!fullyUsedTypes.has(name)) {
          fullyUsedTypes.add(name)
          changed = true
        }
        for (const f of def.fields ?? []) {
          if (markFullyReturn(baseTypeName(f.type))) changed = true
        }
        continue
      }

      if (def.kind === Kind.UNION_TYPE_DEFINITION) {
        for (const member of def.types ?? []) {
          if (addType(member.name.value)) changed = true
        }
        continue
      }
    }
  }
}

function addType(name: string): boolean {
  if (BUILT_IN_SCALARS.has(name)) return false
  if (usedTypes.has(name)) return false
  usedTypes.add(name)
  return true
}

function markFullyReturn(name: string): boolean {
  if (BUILT_IN_SCALARS.has(name)) return false
  const already = fullyUsedTypes.has(name) && usedTypes.has(name)
  if (already) return false
  usedTypes.add(name)
  fullyUsedTypes.add(name)
  return true
}

function cleanField(f: FieldDefinitionNode): FieldDefinitionNode {
  return {
    ...f,
    description: undefined,
    arguments: (f.arguments ?? []).map(cleanInputValue),
    directives: cleanDirectives(f.directives),
  }
}

function cleanInputValue(v: InputValueDefinitionNode): InputValueDefinitionNode {
  return {
    ...v,
    description: undefined,
    directives: cleanDirectives(v.directives),
  }
}

function cleanDirectives(dirs: readonly DirectiveNode[] | undefined): readonly DirectiveNode[] {
  // keep only directives the spec defines so buildSchema doesn't choke on
  // custom linear directives we didn't pull in.
  const SPEC = new Set(['deprecated', 'include', 'skip', 'specifiedBy'])
  return (dirs ?? []).filter(d => SPEC.has(d.name.value))
}
