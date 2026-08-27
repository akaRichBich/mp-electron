import { z } from 'zod'
import { checkPath } from '@mp/core'

/**
 * The narrow door. This is the *only* thing a non-engineer can submit, and it
 * is a form, not a prompt - so there is nothing for the model to guess at.
 *
 * Three things are administratively out of reach here, by construction:
 *   - `dangerous` safety (see `safety` below)
 *   - paths outside the allowlist (rejected before generation, with a reason)
 *   - anything that is not a rule (there is no other spec type)
 */
export const RuleSpec = z.object({
  what: z.string().min(3).max(60).describe('What we are looking for, in the user’s words'),
  paths: z
    .array(
      z.string().superRefine((value, ctx) => {
        const verdict = checkPath(value)
        if (!verdict.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: verdict.reason })
      }),
    )
    .min(1)
    .max(8),
  match: z.enum(['whole-folder', 'by-pattern']),
  pattern: z.string().min(1).optional(),
  category: z.enum(['cache', 'logs', 'build-artifacts', 'package-manager']),
  /** No `dangerous` here on purpose - that level needs an engineer. */
  safety: z.enum(['safe', 'review']),
  explain: z.string().min(20).max(240),
  minAgeDays: z.number().int().min(0).max(3650).optional(),
  /** Sample tree the generated rule must actually find something in. */
  fixture: z.object({
    files: z.record(z.string(), z.number().int().positive()).refine(
      (files) => Object.keys(files).length > 0,
      'a spec without sample data cannot be verified, so it cannot be submitted',
    ),
  }),
  requestedBy: z.string().min(2),
})

export type RuleSpec = z.infer<typeof RuleSpec>

export function ruleIdFor(spec: RuleSpec): string {
  return spec.what
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}
