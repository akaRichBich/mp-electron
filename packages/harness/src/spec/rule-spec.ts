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
  // Messages are written for the person filling in the form, not for a
  // stack trace - the CLI prints these too.
  what: z
    .string()
    .min(3, 'Give it a name a user would recognise, three characters or more.')
    .max(60, 'Keep the name under 60 characters.'),
  paths: z
    .array(
      z.string().superRefine((value, ctx) => {
        const verdict = checkPath(value)
        if (!verdict.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: verdict.reason })
      }),
    )
    .min(1, 'Name at least one folder.')
    .max(8, 'Eight folders is the most one rule should cover.'),
  match: z.enum(['whole-folder', 'by-pattern']),
  pattern: z.string().min(1, 'A pattern is needed when matching by pattern - `*` matches each subfolder.').optional(),
  category: z.enum(['cache', 'logs', 'build-artifacts', 'package-manager']),
  /** No `dangerous` here on purpose - that level needs an engineer. */
  safety: z.enum(['safe', 'review']),
  explain: z
    .string()
    .min(20, 'Say what the user loses and how it comes back - a sentence, not a label.')
    .max(240, 'Keep the explanation under 240 characters; it is shown in a table row.'),
  minAgeDays: z
    .number()
    .int('Whole days only.')
    .min(0, 'Days cannot be negative.')
    .max(3650, 'Ten years is the longest this accepts.')
    .optional(),
  /** Sample tree the generated rule must actually find something in. */
  fixture: z.object({
    files: z.record(z.string(), z.number().int().positive()).refine(
      (files) => Object.keys(files).length > 0,
      'a spec without sample data cannot be verified, so it cannot be submitted',
    ),
  }),
  requestedBy: z.string().min(2, 'Add your name or email, so the pull request says whose idea it was.'),
})

export type RuleSpec = z.infer<typeof RuleSpec>

export function ruleIdFor(spec: Pick<RuleSpec, 'what'>): string {
  return spec.what
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}
