import { fileURLToPath } from 'node:url'
import { utilityProcess } from 'electron'
import type { ScanReport } from '@mp/core'
import type { FromWorker, ToWorker } from './scan-protocol'

export class ScanCancelled extends Error {
  constructor() {
    super('scan cancelled')
    this.name = 'ScanCancelled'
  }
}

/**
 * Owns one utility process per scan. Cancelling is killing it, which is the
 * whole reason the scan lives out there: there is no cooperative flag to
 * check, so a scan deep inside a directory walk stops immediately.
 */
export class ScanService {
  private child: Electron.UtilityProcess | null = null

  get running(): boolean {
    return this.child !== null
  }

  cancel(): void {
    this.child?.kill()
    this.child = null
  }

  run(
    home: string,
    onProgress: (progress: { done: number; total: number; ruleId: string }) => void,
  ): Promise<ScanReport> {
    this.cancel()

    const child = utilityProcess.fork(fileURLToPath(new URL('./scan-worker.js', import.meta.url)), [], {
      serviceName: 'reclaim-scan',
      stdio: 'inherit',
    })
    this.child = child

    return new Promise<ScanReport>((resolve, reject) => {
      let settled = false
      const finish = (fn: () => void) => {
        if (settled) return
        settled = true
        if (this.child === child) this.child = null
        fn()
      }

      child.on('message', (message: FromWorker) => {
        if (message.type === 'progress') {
          onProgress({ done: message.done, total: message.total, ruleId: message.ruleId })
        } else if (message.type === 'done') {
          const report = message.report
          finish(() => {
            child.kill()
            resolve(report)
          })
        } else {
          const detail = message.message
          finish(() => {
            child.kill()
            reject(new Error(detail))
          })
        }
      })

      // A killed child exits without a message. That is a cancel, not a crash.
      child.on('exit', () => finish(() => reject(new ScanCancelled())))

      child.postMessage({ type: 'scan', home } satisfies ToWorker)
    })
  }
}
