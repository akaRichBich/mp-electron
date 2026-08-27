import { isUnder, normalize } from '../util/path'

/**
 * Machine-enforced blast radius. A rule can only ever point inside these
 * prefixes. This is checked by the schema at import time, so a rule that
 * reaches for ~/Documents cannot even be registered - it is not a review
 * convention that someone has to remember.
 */
export const ALLOWED_PREFIXES = [
  '~/Library/Caches',
  '~/Library/Logs',
  '~/Library/Developer/Xcode/DerivedData',
  '~/Library/Developer/Xcode/Archives',
  '~/Library/Developer/CoreSimulator/Caches',
  '~/.cache',
  '~/.npm/_cacache',
  '~/Library/Application Support/Caches',
] as const

/** Wins over the allowlist. Belt and braces for prefixes that nest. */
export const DENIED_PREFIXES = [
  '~/Library/Caches/com.apple.iTunes',
  '~/Library/Caches/CloudKit',
  '~/Library/Keychains',
] as const

export type PathVerdict = { ok: true } | { ok: false; reason: string }

export function checkPath(path: string): PathVerdict {
  const p = normalize(path)
  if (!p.startsWith('~/')) {
    return { ok: false, reason: `must be home-relative and start with "~/", got "${path}"` }
  }
  if (p.includes('..')) {
    return { ok: false, reason: `must not contain ".." (got "${path}")` }
  }
  const denied = DENIED_PREFIXES.find((d) => isUnder(p, d))
  if (denied) {
    return { ok: false, reason: `"${p}" is inside the denied prefix "${denied}"` }
  }
  if (!ALLOWED_PREFIXES.some((a) => isUnder(p, a))) {
    return {
      ok: false,
      reason: `"${p}" is outside every allowed prefix (${ALLOWED_PREFIXES.join(', ')})`,
    }
  }
  return { ok: true }
}
