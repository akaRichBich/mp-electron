import { mkdirSync, truncateSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

/**
 * Creates the one folder v0.0.1 is willing to delete:
 *
 *   pnpm demo:sandbox                  # ~/Library/Caches/ReclaimSandbox
 *   pnpm demo:sandbox --home .demo-home
 *
 * Nothing of yours goes in here. Scan, press remove, watch it actually go -
 * every other finding answers with a reason instead. See `deletionVerdict`.
 */
const index = process.argv.indexOf('--home')
const home = index === -1 ? homedir() : resolve(process.argv[index + 1] ?? '')
// Two of them: browsers may not open anything under ~/Library, so the web
// shell needs a sandbox that lives somewhere it is allowed to look.
const roots = [
  join(home, 'Library', 'Caches', 'ReclaimSandbox'),
  join(home, '.cache', 'ReclaimSandbox'),
]

for (const root of roots) {
  mkdirSync(root, { recursive: true })
  writeFileSync(join(root, 'test.txt'), '')
  writeFileSync(join(root, 'sample.bin'), '')
  truncateSync(join(root, 'sample.bin'), 2_000_000)
  console.log(`sandbox at ${root}`)
}

console.log('\n  test.txt    (empty)')
console.log('  sample.bin  (2 MB, sparse)')
console.log('\nDesktop: scan and the "Reclaim sandbox" rows really delete.')
console.log('Web:     pick ~/.cache (cmd-shift-. shows hidden folders in the dialog).')
