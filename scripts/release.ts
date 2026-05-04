#!/usr/bin/env bun
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { $ } from 'bun'

const root = new URL('..', import.meta.url).pathname
const packagesDir = join(root, 'packages')

type Manifest = {
  name: string
  version: string
  private?: boolean
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

const entries = readdirSync(packagesDir, { withFileTypes: true })
  .filter(e => e.isDirectory())
  .map(e => {
    const dir = join(packagesDir, e.name)
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Manifest
    return { dir, manifest }
  })
  .filter(({ manifest }) => !manifest.private)

// Topological sort by intra-workspace deps
const byName = new Map(entries.map(e => [e.manifest.name, e]))
const sorted: typeof entries = []
const visiting = new Set<string>()
const visited = new Set<string>()

function visit(name: string) {
  if (visited.has(name)) return
  if (visiting.has(name)) throw new Error(`Cycle through ${name}`)
  const entry = byName.get(name)
  if (!entry) return
  visiting.add(name)
  const deps = {
    ...entry.manifest.dependencies,
    ...entry.manifest.peerDependencies,
  }
  for (const dep of Object.keys(deps)) visit(dep)
  visiting.delete(name)
  visited.add(name)
  sorted.push(entry)
}

for (const { manifest } of entries) visit(manifest.name)

for (const { dir, manifest } of sorted) {
  const { name, version } = manifest
  const probe = await $`npm view ${name}@${version} version`.nothrow().quiet()
  const alreadyPublished = probe.exitCode === 0 && probe.stdout.toString().trim() === version
  if (alreadyPublished) {
    console.log(`✓ ${name}@${version} already on npm, skipping`)
    continue
  }
  console.log(`→ packing ${name}@${version}`)
  const pack = await $`bun pm pack`.cwd(dir).text()
  const tarball = pack
    .split('\n')
    .map(l => l.trim())
    .reverse()
    .find(l => l.endsWith('.tgz'))
  if (!tarball) throw new Error(`Could not determine tarball path for ${name}`)
  console.log(`→ publishing ${tarball}`)
  await $`bunx npm publish ${tarball} --access public --provenance`.cwd(dir)
}
