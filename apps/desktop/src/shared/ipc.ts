import type { PortCapabilities, ScanReport } from '@mp/core'

/** The renderer has no node, no fs and no core. This is its entire surface. */
export const CHANNELS = {
  boot: 'reclaim:boot',
  scan: 'reclaim:scan',
  last: 'reclaim:last',
  remove: 'reclaim:remove',
  reveal: 'reclaim:reveal',
  progress: 'reclaim:progress',
  report: 'reclaim:report',
} as const

export interface Boot {
  home: string
  /** True when RECLAIM_HOME points somewhere other than the real home. */
  demo: boolean
  capabilities: PortCapabilities
}

export interface ScanProgress {
  done: number
  total: number
  ruleId: string
}

export interface RemoveResult {
  removed: number
  bytes: number
  /** Paths main refused: not in the last report, or outside the allowlist. */
  refused: string[]
  report: ScanReport | null
}

export interface DesktopApi {
  boot: Boot
  scan(): Promise<ScanReport>
  /** The report from the startup scan, if it finished before the UI mounted. */
  last(): Promise<ScanReport | null>
  remove(paths: string[]): Promise<RemoveResult>
  reveal(path: string): Promise<void>
  onProgress(handler: (progress: ScanProgress) => void): () => void
  onReport(handler: (report: ScanReport) => void): () => void
}
