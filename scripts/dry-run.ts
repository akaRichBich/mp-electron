import { allRules, formatBytes, scan } from '@mp/core'
import { NodeFsPort } from '@mp/port-node'

/**
 * What the rules would report on this machine, printed. Read-only: `scan()`
 * has no way to delete anything - only the desktop shell's remove path does.
 *
 *   pnpm dry-run                        every rule, real home
 *   pnpm dry-run --rule stale-app-logs  one rule
 *   pnpm dry-run --home .demo-home      somewhere else
 */
const argv = process.argv.slice(2)
const flag = (name: string) => {
  const index = argv.indexOf(`--${name}`)
  return index === -1 ? undefined : argv[index + 1]
}

const home = flag('home')
const only = flag('rule')

const port = new NodeFsPort(home)
const report = await scan(port, allRules(), only ? { onlyRules: [only] } : {})

console.log(`\n${formatBytes(report.totalBytes)} across ${report.findings.length} location(s)\n`)
for (const finding of report.findings) {
  console.log(
    `  ${formatBytes(finding.bytes).padStart(10)}  ${finding.safety.padEnd(6)}  ${finding.path}  (${finding.entries} files)`,
  )
}
if (report.skipped.length > 0) {
  console.log('\nnot evaluated:')
  for (const skipped of report.skipped) console.log(`  ${skipped.ruleId.padEnd(20)} ${skipped.reason}`)
}
