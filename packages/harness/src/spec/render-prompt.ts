import { ALLOWED_PREFIXES } from '@mp/core'
import { ruleIdFor, type RuleSpec } from './rule-spec'

/**
 * The prompt is *built*, not written. The same spec always produces the same
 * prompt, so a bad result is a bug in this function or in the recipe - never
 * "the PM phrased it oddly".
 */
export function renderPrompt(spec: RuleSpec): string {
  const id = ruleIdFor(spec)
  const matchers =
    spec.match === 'whole-folder'
      ? spec.paths.map((p) => `{ kind: 'dir', path: '${p}' }`)
      : spec.paths.map((p) => `{ kind: 'glob', root: '${p}', pattern: '${spec.pattern}' }`)

  return [
    `Follow recipes/add-rule.md exactly. Add one rule and nothing else.`,
    ``,
    `id:          ${id}`,
    `title:       ${spec.what}`,
    `category:    ${spec.category}`,
    `safety:      ${spec.safety}`,
    `origin:      spec`,
    spec.minAgeDays === undefined ? null : `minAgeDays:  ${spec.minAgeDays}`,
    `explain:     ${spec.explain}`,
    `matchers:    [${matchers.join(', ')}]`,
    ``,
    `Files you may create or modify, and no others:`,
    `  packages/core/src/rules/${id}.ts`,
    `  packages/core/src/rules/index.ts   (registration only)`,
    `  packages/harness/src/eval/cases/${id}.json`,
    `  packages/harness/fixtures/${id}.json`,
    ``,
    `Constraints, all of them machine-checked by \`pnpm gates\`:`,
    `  - no new dependencies`,
    `  - no import of node:*, electron or any DOM global inside packages/core`,
    `  - every path stays inside: ${ALLOWED_PREFIXES.join(', ')}`,
    `  - the rule must produce at least one finding against its fixture`,
    ``,
    `Requested by: ${spec.requestedBy}`,
  ]
    .filter((line) => line !== null)
    .join('\n')
}
