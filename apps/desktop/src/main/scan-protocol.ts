import type { ScanReport } from '@mp/core'

/** The only things that cross the utility-process boundary. */
export type ToWorker = { type: 'scan'; home: string }

export type FromWorker =
  | { type: 'progress'; done: number; total: number; ruleId: string }
  | { type: 'done'; report: ScanReport }
  | { type: 'failed'; message: string }
