import { describe, expect, it } from 'vitest'
import type { Finding, SafetyLevel } from '@mp/core'
import { partitionRemovable } from '../src/main/guard'

const finding = (
  path: string,
  bytes = 100,
  ruleId = 'sandbox',
  safety: SafetyLevel = 'safe',
): Finding => ({
  ruleId,
  title: ruleId,
  safety,
  explain: 'x'.repeat(30),
  path,
  bytes,
  entries: 1,
})

const SANDBOX = '~/Library/Caches/ReclaimSandbox'
const report = [finding(SANDBOX, 500), finding('~/Library/Caches/pip', 250, 'pip-cache')]

describe('partitionRemovable', () => {
  it('allows a sandbox path main itself reported', () => {
    expect(partitionRemovable([SANDBOX], report)).toEqual({
      allowed: [SANDBOX],
      refused: [],
      bytes: 500,
    })
  })

  it('refuses a path that was never in the report, even inside the allowlist', () => {
    const result = partitionRemovable([`${SANDBOX}/nope`], report)
    expect(result.allowed).toEqual([])
    expect(result.refused).toEqual([`${SANDBOX}/nope`])
  })

  it.each(['~/Documents', `${SANDBOX}/../../../Documents`, '/etc/passwd', '~/Library/Keychains'])(
    'refuses %s',
    (path) => {
      // Even if a tampered report claims it, the allowlist still rejects it.
      const tampered = [...report, finding(path)]
      expect(partitionRemovable([path], tampered).allowed).toEqual([])
    },
  )

  it('refuses a dangerous finding even though it is in the report', () => {
    // RuleSchema says `dangerous` is report-only. That promise is kept here,
    // not in the UI - the renderer is not trusted to keep it.
    const risky = finding(SANDBOX, 100, 'sandbox', 'dangerous')
    expect(partitionRemovable([risky.path], [risky]).refused).toEqual([risky.path])
  })

  it('refuses a safe rule this build is not willing to delete', () => {
    // The v0.0.1 fence: `pip-cache` is safe, and still not removable, because
    // a demo has no business emptying a real cache.
    const result = partitionRemovable(['~/Library/Caches/pip'], report)
    expect(result.allowed).toEqual([])
    expect(result.refused).toEqual(['~/Library/Caches/pip'])
  })

  it('bills only the paths it allowed', () => {
    const result = partitionRemovable([SANDBOX, '~/Documents'], report)
    expect(result.bytes).toBe(500)
    expect(result.refused).toEqual(['~/Documents'])
  })
})
