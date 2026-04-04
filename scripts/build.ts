#!/usr/bin/env bun
/**
 * Build Script for RepliQL Monorepo
 * Orchestrates building all library packages and the playground
 */

import { $ } from 'bun'
import path from 'path'
import fs from 'fs'

const ROOT = import.meta.dir.replace('/scripts', '')
const PACKAGES_DIR = path.join(ROOT, 'packages')
const PLAYGROUND_DIR = path.join(ROOT, 'playground')

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
 * Build playground web app
 */
async function buildPlayground(): Promise<BuildResult> {
  try {
    const startTime = Date.now()
    log('Building playground...')

    await $`cd ${PLAYGROUND_DIR} && bun run build`

    const duration = Date.now() - startTime
    log(`Built playground in ${duration}ms`, 'success')

    return {
      name: 'playground',
      success: true,
      duration,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    log(`Failed to build playground: ${errorMsg}`, 'error')

    return {
      name: 'playground',
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

  // Get list of packages
  const packages = fs
    .readdirSync(PACKAGES_DIR)
    .filter(name => fs.statSync(path.join(PACKAGES_DIR, name)).isDirectory())

  // Build all packages in parallel
  log(`Building ${packages.length} package(s)...`)
  const packageResults = await Promise.all(packages.map(buildPackage))
  results.push(...packageResults)

  // Build playground
  const playgroundResult = await buildPlayground()
  results.push(playgroundResult)

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
