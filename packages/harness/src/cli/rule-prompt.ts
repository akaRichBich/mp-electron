import { readFileSync } from 'node:fs'
import { RuleSpec } from '../spec/rule-spec'
import { renderPrompt } from '../spec/render-prompt'

/**
 * `pnpm rule:prompt <spec.json>` - just the prompt, nothing written.
 *
 * `rule:new` prints it too, but also writes the fixture and the eval case; CI
 * needs the prompt on its own, after generation has already happened.
 */
const [, , specPath] = process.argv
if (!specPath) {
  console.error('usage: pnpm rule:prompt <spec.json>')
  process.exit(2)
}

const parsed = RuleSpec.safeParse(JSON.parse(readFileSync(specPath, 'utf8')))
if (!parsed.success) {
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.') || '(form)'}: ${issue.message}`)
  }
  process.exit(1)
}

console.log(renderPrompt(parsed.data))
