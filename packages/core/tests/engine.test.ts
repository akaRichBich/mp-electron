import { describe, expect, it } from 'vitest'
import fixture from '../fixtures/mac-dev-home.json'
import { FIXTURE_NOW, FakeFsPort, type Fixture } from '../src/ports/fake-fs'
import { allRules } from '../src/rule/registry'
import { scan } from '../src/scan/engine'
import '../src/rules/index'

const port = () => new FakeFsPort(fixture as Fixture)

describe('scan', () => {
  it('finds the seeded caches and never leaves the allowlist', async () => {
    const report = await scan(port(), allRules(), { now: FIXTURE_NOW })
    const ids = report.findings.map((f) => f.ruleId)
    expect(ids).toContain('homebrew-cache')
    expect(ids).toContain('pip-cache')
    expect(report.findings.every((f) => !f.path.includes('Documents'))).toBe(true)
  })

  it('honours minAgeDays per project folder', async () => {
    const report = await scan(port(), allRules(), { now: FIXTURE_NOW, onlyRules: ['xcode-derived-data'] })
    expect(report.findings.map((f) => f.path)).toEqual([
      '~/Library/Developer/Xcode/DerivedData/App-abc',
    ])
  })

  it('is deterministic', async () => {
    const a = await scan(port(), allRules(), { now: FIXTURE_NOW })
    const b = await scan(port(), allRules(), { now: FIXTURE_NOW })
    expect(a).toEqual(b)
  })

  it('evaluates only the matchers the port can reach', async () => {
    // `sandbox` looks in two places. A port that can see one of them must not
    // report the other - the fake port can see the whole tree, so nothing but
    // this check stops it.
    const picked = new FakeFsPort(fixture as Fixture)
    Object.defineProperty(picked, 'mounts', { value: () => ['~/.cache'] })
    const report = await scan(picked, allRules(), { now: FIXTURE_NOW, onlyRules: ['sandbox'] })
    expect(report.findings.map((f) => f.path)).toEqual(['~/.cache/ReclaimSandbox'])
  })

  it('skips rules the port cannot reach instead of failing', async () => {
    const picked = new FakeFsPort(fixture as Fixture)
    Object.defineProperty(picked, 'mounts', { value: () => ['~/Library/Caches/pip'] })
    const report = await scan(picked, allRules(), { now: FIXTURE_NOW })
    expect(report.skipped.map((s) => s.ruleId)).toContain('homebrew-cache')
    expect(report.findings.map((f) => f.ruleId)).toEqual(['pip-cache'])
  })
})
