import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { FIXTURE_NOW, FakeFsPort, RuleSchema, getRule, scan, type Fixture } from '@mp/core'

export type CheckResult = { ok: true } | { ok: false; detail: string }

export interface EvalCase {
  ruleId: string
  fixture: string
  expect: {
    minFindings: number
    /** Paths that must never appear in the report for this fixture. */
    neverTouches?: string[]
  }
}

const repoRoot = new URL('../../../../', import.meta.url).pathname

export const checks = {
  /** The rule parses against the contract - including the allowlist refinements. */
  schema_valid(c: EvalCase): CheckResult {
    const rule = getRule(c.ruleId)
    if (!rule) return { ok: false, detail: `rule "${c.ruleId}" is not in the registry` }
    const parsed = RuleSchema.safeParse(rule)
    return parsed.success
      ? { ok: true }
      : { ok: false, detail: parsed.error.issues.map((i) => i.message).join('; ') }
  },

  /** A rule nobody wired up is a rule that silently does nothing. */
  registered_in(c: EvalCase): CheckResult {
    const source = readFileSync(`${repoRoot}packages/core/src/rules/index.ts`, 'utf8')
    return source.includes(c.ruleId.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase())) ||
      source.includes(c.ruleId)
      ? { ok: true }
      : { ok: false, detail: `not referenced in packages/core/src/rules/index.ts` }
  },

  /** It actually finds something, on data that ships with the repo. */
  async runs_against(c: EvalCase): Promise<CheckResult> {
    const fixture = JSON.parse(readFileSync(`${repoRoot}${c.fixture}`, 'utf8')) as Fixture
    const rule = getRule(c.ruleId)
    if (!rule) return { ok: false, detail: `rule "${c.ruleId}" is not in the registry` }
    const report = await scan(new FakeFsPort(fixture), [rule], { now: FIXTURE_NOW })
    if (report.findings.length < c.expect.minFindings) {
      return {
        ok: false,
        detail: `expected >= ${c.expect.minFindings} findings, got ${report.findings.length}`,
      }
    }
    for (const forbidden of c.expect.neverTouches ?? []) {
      const hit = report.findings.find((f) => f.path.startsWith(forbidden))
      if (hit) return { ok: false, detail: `reported a path under ${forbidden}: ${hit.path}` }
    }
    return { ok: true }
  },

  /** The architecture guard, run as part of the suite so a rule cannot break the web build. */
  no_platform_imports(): CheckResult {
    try {
      execFileSync('node', ['--import', 'tsx', 'scripts/check-architecture.ts'], {
        cwd: repoRoot,
        stdio: 'pipe',
      })
      return { ok: true }
    } catch (error) {
      const err = error as { stdout?: Buffer; stderr?: Buffer }
      return { ok: false, detail: String(err.stdout ?? err.stderr ?? error).trim() }
    }
  },
}
