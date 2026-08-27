import { mkdirSync, rmSync, truncateSync, utimesSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

/**
 * A throwaway home directory for demoing and testing the desktop app:
 *
 *   pnpm demo:home
 *   RECLAIM_HOME=.demo-home pnpm --filter @mp/desktop dev
 *
 * The app deletes for real, so it should be pointed at this rather than at a
 * developer's actual caches. Files are sparse - the tree reports ~500 MB and
 * occupies almost nothing.
 */
const root = resolve(process.argv[2] ?? '.demo-home')
const DAY = 86_400_000

const files: Record<string, { size: number; ageDays?: number }> = {
  'Library/Caches/Homebrew/downloads/node--22.tar.gz': { size: 48_000_000 },
  'Library/Caches/Homebrew/downloads/ffmpeg--7.1.tar.gz': { size: 92_000_000 },
  'Library/Caches/Homebrew/api/formula.jws.json': { size: 4_200_000 },
  'Library/Caches/pip/wheels/numpy-2.1.3.whl': { size: 18_000_000 },
  'Library/Caches/pip/http-v2/0/1/body': { size: 7_300_000 },
  'Library/Caches/pypoetry/artifacts/requests-2.32.whl': { size: 240_000 },
  'Library/Developer/Xcode/DerivedData/App-abc/Build/bin': { size: 310_000_000, ageDays: 40 },
  'Library/Developer/Xcode/DerivedData/Fresh-xyz/out.o': { size: 5_000_000, ageDays: 1 },
  'Library/Logs/DiagnosticReports/crash-1.ips': { size: 240_000 },
  // Deliberately outside the allowlist: nothing should ever touch this.
  'Documents/thesis.pdf': { size: 3_000_000 },
}

rmSync(root, { recursive: true, force: true })

for (const [relative, spec] of Object.entries(files)) {
  const path = join(root, relative)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, '')
  truncateSync(path, spec.size)
  if (spec.ageDays) {
    const when = new Date(Date.now() - spec.ageDays * DAY)
    utimesSync(path, when, when)
  }
}

console.log(`demo home at ${root}`)
console.log(`RECLAIM_HOME=${root} pnpm --filter @mp/desktop dev`)
