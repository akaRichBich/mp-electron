import { readFileSync } from 'node:fs'
import { RuleSpec, ruleIdFor } from '../spec/rule-spec'

/**
 * `pnpm rule:id <spec.json>` - the id this spec produces, and nothing else.
 *
 * The id comes from the request's own words, not from what the file happens to
 * be called. CI derived it from the filename once, and the file-scope fence
 * then reverted the rule the agent had correctly written.
 */
const [, , specPath] = process.argv
if (!specPath) {
  console.error('usage: pnpm rule:id <spec.json>')
  process.exit(2)
}

const parsed = RuleSpec.safeParse(JSON.parse(readFileSync(specPath, 'utf8')))
if (!parsed.success) {
  console.error(parsed.error.issues.map((issue) => issue.message).join('; '))
  process.exit(1)
}

console.log(ruleIdFor(parsed.data))
