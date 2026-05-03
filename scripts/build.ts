#!/usr/bin/env bun
/**
 * Build Script for RepliQL Monorepo
 * Orchestrates building all library packages and the playground
 * Builds packages in dependency order to ensure declaration files are available
 */

import fs from 'fs'
import path from 'path'

import { $ } from 'bun'

const ROOT = import.meta.dir.replace('/scripts', '')
const PACKAGES_DIR = path.join(ROOT, 'packages')

interface BuildResult {
  name: string
  success: boolean
  error?: string
  duration?: number
}

const results: BuildResult[] = []

/**
 * Log with styling
 */
function log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const icons = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warn: '⚠️',
  }
  console.log(`${icons[type]} ${message}`)
}

/**
 * Get internal dependencies for a package (dependencies starting with @repliql/)
 */
function getInternalDependencies(packageName: string): string[] {
  const pkgPath = path.join(PACKAGES_DIR, packageName)
  const packageJsonPath = path.join(pkgPath, 'package.json')

  if (!fs.existsSync(packageJsonPath)) {
    return []
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.peerDependencies,
  }

  return Object.keys(allDeps)
    .filter(dep => dep.startsWith('@repliql/'))
    .map(dep => dep.replace('@repliql/', ''))
}

/**
 * Topologically sort packages based on their dependencies
 * Returns packages in build order (dependencies first)
 */
function sortPackagesByDependencies(packages: string[]): string[] {
  const graph = new Map<string, string[]>()
  const inDegree = new Map<string, number>()

  // Initialize
  for (const pkg of packages) {
    graph.set(pkg, [])
    inDegree.set(pkg, 0)
  }

  // Build dependency graph
  for (const pkg of packages) {
    const deps = getInternalDependencies(pkg)
    for (const dep of deps) {
      if (packages.includes(dep)) {
        graph.get(dep)!.push(pkg)
        inDegree.set(pkg, (inDegree.get(pkg) || 0) + 1)
      }
    }
  }

  // Kahn's algorithm for topological sort
  const queue: string[] = []
  const result: string[] = []

  // Start with packages that have no dependencies
  for (const pkg of packages) {
    if (inDegree.get(pkg) === 0) {
      queue.push(pkg)
    }
  }

  while (queue.length > 0) {
    const pkg = queue.shift()!
    result.push(pkg)

    for (const dependent of graph.get(pkg) || []) {
      inDegree.set(dependent, inDegree.get(dependent)! - 1)
      if (inDegree.get(dependent) === 0) {
        queue.push(dependent)
      }
    }
  }

  // Check for circular dependencies
  if (result.length !== packages.length) {
    log('Warning: Circular dependencies detected, falling back to original order', 'warn')
    return packages
  }

  return result
}

/**
 * Build a single library package
 */
async function buildPackage(packageName: string): Promise<BuildResult> {
  const pkgPath = path.join(PACKAGES_DIR, packageName)
  const packageJsonPath = path.join(pkgPath, 'package.json')

  if (!fs.existsSync(packageJsonPath)) {
    return {
      name: packageName,
      success: false,
      error: 'package.json not found',
    }
  }

  try {
    const startTime = Date.now()
    log(`Building ${packageName}...`)

    await $`cd ${pkgPath} && bun run build`

    const duration = Date.now() - startTime
    log(`Built ${packageName} in ${duration}ms`, 'success')

    return {
      name: packageName,
      success: true,
      duration,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    log(`Failed to build ${packageName}: ${errorMsg}`, 'error')

    return {
      name: packageName,
      success: false,
      error: errorMsg,
    }
  }
}

/**
 * Main build orchestration
 */
async function main() {
  log('🚀 Starting monorepo build...')
  console.log()

  // Get list of packages and sort by dependencies
  const packages = fs
    .readdirSync(PACKAGES_DIR)
    .filter(name => fs.statSync(path.join(PACKAGES_DIR, name)).isDirectory())

  const sortedPackages = sortPackagesByDependencies(packages)

  // Build packages in dependency order (sequentially to ensure types are available)
  log(`Building ${sortedPackages.length} package(s) in dependency order...`)
  log(`Build order: ${sortedPackages.join(' → ')}`)
  console.log()

  for (const pkg of sortedPackages) {
    const result = await buildPackage(pkg)
    results.push(result)

    // Stop on failure since dependent packages won't build without types
    if (!result.success) {
      log(`Stopping build due to failure in ${pkg}`, 'error')
      break
    }
  }

  // Summary
  console.log('\n📊 Build Summary:')
  console.log('─'.repeat(50))

  let totalTime = 0
  for (const result of results) {
    const status = result.success ? '✅' : '❌'
    const time = result.duration ? ` (${result.duration}ms)` : ''
    const error = result.error ? ` - ${result.error}` : ''
    console.log(`${status} ${result.name}${time}${error}`)
    if (result.duration) totalTime += result.duration
  }

  console.log('─'.repeat(50))
  const successCount = results.filter(r => r.success).length
  const totalCount = results.length
  log(
    `Build complete: ${successCount}/${totalCount} packages built in ${totalTime}ms`,
    successCount === totalCount ? 'success' : 'warn',
  )

  process.exit(successCount === totalCount ? 0 : 1)
}

main().catch(error => {
  log(`Build failed with error: ${error}`, 'error')
  process.exit(1)
})
