import type { LogicalPath, PortCapabilities } from '../ports/fs-port'
import type { Rule, SafetyLevel } from '../rule/schema'

export interface Finding {
  ruleId: Rule['id']
  title: string
  safety: SafetyLevel
  explain: string
  path: LogicalPath
  bytes: number
  entries: number
}

export interface SkippedRule {
  ruleId: string
  reason: string
}

export interface ScanReport {
  portId: string
  capabilities: PortCapabilities
  findings: Finding[]
  skipped: SkippedRule[]
  totalBytes: number
}

export interface ScanOptions {
  /** Injected so a scan over a fixture is byte-for-byte reproducible. */
  now?: number
  onlyRules?: string[]
  /** Called before each rule, so a shell can show real progress, not a spinner. */
  onProgress?: (progress: { done: number; total: number; ruleId: string }) => void
}
