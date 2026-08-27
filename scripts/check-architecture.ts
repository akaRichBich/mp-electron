import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The rule that stops an agent from quietly breaking one of the two shells:
 * `packages/core` must stay platform-free. Nothing in it may reach for node,
 * electron or the DOM - the moment it does, the PWA build dies, and it dies
 * far away from the change that caused it. So we fail here instead.
 */
const FORBIDDEN: Array<{ pattern: RegExp; why: string }> = [
  { pattern: /from\s+['"]node:/, why: 'node built-in import' },
  { pattern: /require\(['"]node:/, why: 'node built-in require' },
  { pattern: /from\s+['"](fs|path|os|child_process|crypto)['"]/, why: 'node built-in import' },
  { pattern: /from\s+['"]electron['"]/, why: 'electron import' },
  { pattern: /\b(window|document|navigator|localStorage)\s*\./, why: 'DOM global' },
  { pattern: /\bprocess\.(env|platform|cwd)\b/, why: 'process global' },
]

const roots = ['packages/core/src']
const problems: string[] = []

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.ts') ? [full] : []
  })
}

for (const root of roots) {
  for (const file of walk(root)) {
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, index) => {
      if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) return
      for (const { pattern, why } of FORBIDDEN) {
        if (pattern.test(line)) problems.push(`${file}:${index + 1}  ${why}  ${line.trim()}`)
      }
    })
  }
}

if (problems.length > 0) {
  console.error('packages/core must stay platform-free:\n')
  for (const problem of problems) console.error(`  ${problem}`)
  console.error('\nMove the platform call behind FsPort and implement it in a port package.')
  process.exit(1)
}

console.log(`core is platform-free (${roots.map((r) => walk(r).length).reduce((a, b) => a + b, 0)} files checked)`)
