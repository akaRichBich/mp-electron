import { describe, expect, it } from 'vitest'
import type { Finding } from '@mp/core'
import { partitionRemovable } from '../src/main/guard'

const finding = (path: string, bytes = 100): Finding => ({
  ruleId: 'pip-cache',
  title: 'pip cache',
  safety: 'safe',
  explain: 'x'.repeat(30),
  path,
  bytes,
  entries: 1,
})

const report = [finding('~/Library/Caches/pip', 500), finding('~/Library/Caches/Homebrew', 250)]

describe('partitionRemovable', () => {
  it('allows what main itself reported', () => {
    const result = partitionRemovable(['~/Library/Caches/pip'], report)
    expect(result).toEqual({ allowed: ['~/Library/Caches/pip'], refused: [], bytes: 500 })
  })

  it('refuses a path that was never in the report, even inside the allowlist', () => {
    const result = partitionRemovable(['~/Library/Caches/somethingElse'], report)
    expect(result.allowed).toEqual([])
    expect(result.refused).toEqual(['~/Library/Caches/somethingElse'])
  })

  it.each([
    '~/Documents',
    '~/Library/Caches/pip/../../../Documents',
    '/etc/passwd',
    '~/Library/Keychains',
  ])('refuses %s', (path) => {
    // Even if a tampered-with report claims it, the allowlist still rejects it.
    const tampered = [...report, finding(path)]
    expect(partitionRemovable([path], tampered).allowed).toEqual([])
  })

  it('bills only the paths it allowed', () => {
    const result = partitionRemovable(['~/Library/Caches/pip', '~/Documents'], report)
    expect(result.bytes).toBe(500)
    expect(result.refused).toEqual(['~/Documents'])
  })
})
