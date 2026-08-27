import type { Finding } from '../scan/types'
import type { Rule } from '../rule/schema'

/**
 * v0.0.1 is a demonstration of the architecture, not a disk cleaner. It knows
 * how to delete - the whole path is wired, on both shells - but it is only
 * allowed to do it inside a folder that exists for that purpose.
 *
 * That way the delete path is genuinely exercised (permission grant, native
 * confirm, real `rm`, rescan) without a demo build removing a stranger's
 * Homebrew cache because a rule was slightly wrong.
 *
 * To ship for real, this list becomes every `safe` rule - and nothing else in
 * the codebase has to change.
 */
export const DELETABLE_RULES: readonly Rule['id'][] = ['sandbox']

export type DeletionVerdict =
  | { allowed: true }
  | { allowed: false; reason: 'not-safe' | 'demo-build'; title: string; detail: string }

export function deletionVerdict(finding: Pick<Finding, 'ruleId' | 'safety'>): DeletionVerdict {
  if (finding.safety !== 'safe') {
    return {
      allowed: false,
      reason: 'not-safe',
      title: `This one is marked "${finding.safety}"`,
      detail:
        'Only rules marked `safe` are ever offered for removal. Anything else is reported so you can look at it yourself.',
    }
  }
  if (!DELETABLE_RULES.includes(finding.ruleId)) {
    return {
      allowed: false,
      reason: 'demo-build',
      title: 'Deletion is switched off on purpose',
      detail:
        'This is v0.0.1 - a demo of one core running in two shells, not a disk cleaner. The delete path is real and fully wired, but it is fenced to the `sandbox` rule so that a demo cannot remove something it should not. Run `pnpm demo:sandbox` and scan again to watch it actually work.',
    }
  }
  return { allowed: true }
}

export function deletableFindings<T extends Pick<Finding, 'ruleId' | 'safety'>>(findings: T[]): T[] {
  return findings.filter((finding) => deletionVerdict(finding).allowed)
}
