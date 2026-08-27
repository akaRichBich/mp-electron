import { readFileSync, readdirSync } from 'node:fs'
import '@mp/core'
import { checks, type CheckResult, type EvalCase } from './checks'

const casesDir = new URL('./cases/', import.meta.url).pathname
const names = readdirSync(casesDir).filter((f) => f.endsWith('.json')).sort()

const suite = [
  ['schema_valid', (c: EvalCase) => checks.schema_valid(c)],
  ['registered_in', (c: EvalCase) => checks.registered_in(c)],
  ['runs_against', (c: EvalCase) => checks.runs_against(c)],
  ['no_platform_imports', () => checks.no_platform_imports()],
] as const

let passed = 0
let total = 0
const failures: string[] = []

for (const name of names) {
  const c = JSON.parse(readFileSync(casesDir + name, 'utf8')) as EvalCase
  const line: string[] = []
  for (const [label, run] of suite) {
    total++
    const result: CheckResult = await run(c)
    if (result.ok) {
      passed++
      line.push(`PASS ${label}`)
    } else {
      line.push(`FAIL ${label}`)
      failures.push(`${c.ruleId} / ${label}: ${result.detail}`)
    }
  }
  console.log(`${c.ruleId.padEnd(22)} ${line.join('   ')}`)
}

const rate = total === 0 ? 0 : Math.round((passed / total) * 100)
console.log(`\n${passed}/${total} checks passed (${rate}%) across ${names.length} rules`)

if (failures.length > 0) {
  console.log('')
  for (const failure of failures) console.log(`  - ${failure}`)
  process.exit(1)
}
