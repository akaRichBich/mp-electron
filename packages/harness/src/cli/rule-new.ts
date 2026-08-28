import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { RuleSpec, ruleIdFor } from '../spec/rule-spec'
import { renderPrompt } from '../spec/render-prompt'

/**
 * `pnpm rule:new <spec.json>`
 *
 * Turns a QA/PM spec into everything the generation step needs:
 *   - a deterministic prompt
 *   - a fixture the rule must find something in
 *   - an eval case that CI will run from now on
 *
 * If the spec does not validate, nothing is generated and the reason is a
 * sentence about the form, not a stack trace.
 */
const [, , specPath] = process.argv
if (!specPath) {
  console.error('usage: pnpm rule:new <spec.json>')
  process.exit(2)
}

const repoRoot = new URL('../../../../', import.meta.url).pathname
const parsed = RuleSpec.safeParse(JSON.parse(readFileSync(specPath, 'utf8')))

if (!parsed.success) {
  console.error('This spec cannot be submitted:\n')
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.') || '(form)'}: ${issue.message}`)
  }
  process.exit(1)
}

const spec = parsed.data
const id = ruleIdFor(spec)

/**
 * A rule with `minAgeDays` ignores anything newer than that, and the sample
 * data the form derives is brand new - so the fixture would contain nothing the
 * rule is allowed to see, and its eval could never pass. Age the samples past
 * the threshold so the fixture actually exercises the rule that was asked for.
 */
const files = Object.fromEntries(
  Object.entries(spec.fixture.files).map(([path, size]) =>
    spec.minAgeDays === undefined
      ? [path, size]
      : [path, { size, ageDays: spec.minAgeDays + 30 }],
  ),
)

const fixturePath = `packages/harness/fixtures/${id}.json`
mkdirSync(`${repoRoot}packages/harness/fixtures`, { recursive: true })
writeFileSync(`${repoRoot}${fixturePath}`, JSON.stringify({ name: id, files }, null, 2) + '\n')

const casePath = `packages/harness/src/eval/cases/${id}.json`
writeFileSync(
  `${repoRoot}${casePath}`,
  JSON.stringify(
    {
      ruleId: id,
      fixture: fixturePath,
      expect: { minFindings: 1, neverTouches: ['~/Documents', '~/Desktop'] },
    },
    null,
    2,
  ) + '\n',
)

console.log(`wrote ${fixturePath}`)
console.log(`wrote ${casePath}`)
console.log(`\n--- prompt ---\n`)
console.log(renderPrompt(spec))
