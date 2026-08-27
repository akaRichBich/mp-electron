import { describe, expect, it } from 'vitest'
import { checkPath } from '../src/safety/allowlist'
import { RuleSchema } from '../src/rule/schema'

describe('path allowlist', () => {
  it('accepts a cache path', () => {
    expect(checkPath('~/Library/Caches/pip')).toEqual({ ok: true })
  })

  it.each([
    ['~/Documents', 'outside every allowed prefix'],
    ['/System/Library', 'home-relative'],
    ['~/Library/Caches/../../Documents', '".."'],
    ['~/Library/Keychains', 'denied prefix'],
  ])('rejects %s', (path, reason) => {
    const verdict = checkPath(path)
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) expect(verdict.reason).toContain(reason)
  })
})

describe('RuleSchema', () => {
  const base = {
    id: 'demo-rule',
    title: 'Demo',
    category: 'cache' as const,
    safety: 'safe' as const,
    explain: 'A perfectly ordinary explanation of what gets removed here.',
    matchers: [{ kind: 'dir' as const, path: '~/Library/Caches/demo' }],
  }

  it('refuses a rule that points outside the allowlist', () => {
    const result = RuleSchema.safeParse({
      ...base,
      matchers: [{ kind: 'dir', path: '~/Documents/important' }],
    })
    expect(result.success).toBe(false)
  })

  it('refuses a spec-authored dangerous rule', () => {
    const result = RuleSchema.safeParse({ ...base, origin: 'spec', safety: 'dangerous' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('requires an engineer-authored rule')
    }
  })

  it('allows an engineer-authored dangerous rule', () => {
    expect(RuleSchema.safeParse({ ...base, origin: 'engineer', safety: 'dangerous' }).success).toBe(true)
  })
})
