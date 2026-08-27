# Recipe: add a cleanup rule

Input: a validated spec (see `packages/harness/src/spec/rule-spec.ts`) and the
prompt produced by `pnpm rule:new <spec.json>`.

## Steps

1. Create `packages/core/src/rules/<id>.ts`:

   ```ts
   import { defineRule } from '../rule/schema'

   export const <camelId> = defineRule({
     id: '<id>',
     title: '<title>',
     category: '<category>',
     safety: '<safe|review>',
     origin: 'spec',
     explain: '<one plain sentence: what is lost, and how it comes back>',
     matchers: [ /* from the prompt, verbatim */ ],
   })
   ```

   `defineRule` parses against `RuleSchema` at import time, so a path outside
   the allowlist fails the build rather than shipping.

2. Register it in `packages/core/src/rules/index.ts` - import and add to the
   single `register(...)` call. Keep the list alphabetical.

3. Confirm `packages/harness/fixtures/<id>.json` and
   `packages/harness/src/eval/cases/<id>.json` exist (`pnpm rule:new` writes
   both). Do not weaken `minFindings` or drop `neverTouches` to make a test
   pass - if the rule finds nothing, the rule is wrong.

4. Run `pnpm gates`. All four gates must be green.

## Never

- add a dependency
- edit anything under `packages/core/src/{ports,scan,safety,rule}`
- change `ALLOWED_PREFIXES`
- set `safety: 'dangerous'` (the schema rejects it for `origin: 'spec'`)
