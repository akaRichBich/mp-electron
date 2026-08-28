import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The rule that stops an agent from quietly breaking one of the two shells.
 *
 *   packages/core - the domain. No node, no electron, no DOM. It is compiled
 *                   into a browser tab and into an Electron main process, and
 *                   a platform call in here breaks one of them far away from
 *                   the change that caused it.
 *   packages/ui   - presentation. DOM is its job; node and electron are not.
 */
const NODE_AND_ELECTRON = [
  { pattern: /from\s+['"]node:/, why: 'node built-in import' },
  { pattern: /require\(['"]node:/, why: 'node built-in require' },
  { pattern: /from\s+['"](fs|path|os|child_process|crypto)['"]/, why: 'node built-in import' },
  { pattern: /from\s+['"]electron['"]/, why: 'electron import' },
  { pattern: /\bprocess\.(env|platform|cwd)\b/, why: 'process global' },
]

const DOM = [{ pattern: /\b(window|document|navigator|localStorage)\s*\./, why: 'DOM global' }]

const ROOTS = [
  { dir: 'packages/core/src', forbidden: [...NODE_AND_ELECTRON, ...DOM] },
  { dir: 'packages/ui/src', forbidden: NODE_AND_ELECTRON },
  // Shared with the browser form, so it may not reach for node either.
  { dir: 'packages/harness/src/spec', forbidden: [...NODE_AND_ELECTRON, ...DOM] },
]

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.ts') || full.endsWith('.tsx') ? [full] : []
  })
}

const problems: string[] = []
let checked = 0

for (const root of ROOTS) {
  for (const file of walk(root.dir)) {
    checked++
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, index) => {
        const trimmed = line.trimStart()
        if (trimmed.startsWith('*') || trimmed.startsWith('//')) return
        for (const { pattern, why } of root.forbidden) {
          if (pattern.test(line)) problems.push(`${file}:${index + 1}  ${why}  ${trimmed}`)
        }
      })
  }
}

if (problems.length > 0) {
  console.error('these packages must stay platform-free:\n')
  for (const problem of problems) console.error(`  ${problem}`)
  console.error('\nMove the platform call behind FsPort and implement it in a port package.')
  process.exit(1)
}

console.log(`core, ui and the spec are platform-free (${checked} files checked)`)
