import { z } from 'zod'
import { checkPath } from '../safety/allowlist'

/**
 * `safe`      - delete without asking.
 * `review`    - show the user the list first.
 * `dangerous` - report only, never offer deletion. Engineer-authored only.
 */
export const SafetyLevel = z.enum(['safe', 'review', 'dangerous'])
export type SafetyLevel = z.infer<typeof SafetyLevel>

export const Category = z.enum(['cache', 'logs', 'build-artifacts', 'package-manager'])
export type Category = z.infer<typeof Category>

const pathField = z.string().superRefine((value, ctx) => {
  const verdict = checkPath(value)
  if (!verdict.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: verdict.reason })
})

export const Matcher = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('dir'), path: pathField }),
  z.object({ kind: z.literal('glob'), root: pathField, pattern: z.string().min(1) }),
])
export type Matcher = z.infer<typeof Matcher>

export const RuleSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,40}$/, 'kebab-case id'),
    title: z.string().min(3).max(60),
    category: Category,
    safety: SafetyLevel,
    /** Shown verbatim to the end user. Must say what is lost, in plain words. */
    explain: z.string().min(20).max(240),
    matchers: z.array(Matcher).min(1).max(8),
    /** Ignore entries touched more recently than this. */
    minAgeDays: z.number().int().min(0).max(3650).optional(),
    /** Who wrote it. `spec` = generated from a QA/PM spec form. */
    origin: z.enum(['engineer', 'spec']).default('engineer'),
  })
  .superRefine((rule, ctx) => {
    if (rule.origin === 'spec' && rule.safety === 'dangerous') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['safety'],
        message:
          'a spec-authored rule may not be `dangerous` - that level requires an engineer-authored rule',
      })
    }
  })

export type Rule = z.infer<typeof RuleSchema>

export function defineRule(input: z.input<typeof RuleSchema>): Rule {
  return RuleSchema.parse(input)
}
