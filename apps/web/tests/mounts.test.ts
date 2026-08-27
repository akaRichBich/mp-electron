import { describe, expect, it } from 'vitest'
import fixture from '@mp/core/fixtures/mac-dev-home.json'
import { FIXTURE_NOW, FakeFsPort, allRules, scan, type Fixture } from '@mp/core'
import { MOUNTS } from '../src/platform'

/**
 * The picker offers a folder; a folder no rule looks at is a button that can
 * only ever report nothing. That shipped once - `~/Library/Logs` was offered
 * before any log rule existed - so it is a gate now.
 */
describe('every offered mount is covered by a rule', () => {
  it.each(MOUNTS.map((mount) => [mount.label, mount.path] as const))(
    '%s finds something in the reference fixture',
    async (_label, path) => {
      const port = new FakeFsPort(fixture as Fixture)
      Object.defineProperty(port, 'mounts', { value: () => [path] })

      const report = await scan(port, allRules(), { now: FIXTURE_NOW })

      expect(report.findings.length).toBeGreaterThan(0)
      expect(report.findings.every((finding) => finding.path.startsWith(path))).toBe(true)
    },
  )
})
