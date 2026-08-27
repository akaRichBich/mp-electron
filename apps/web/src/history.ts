import type { ScanReport } from '@mp/core'

/**
 * Last report per mount, so an offline launch still has something to show.
 * Deliberately hand-rolled: one object store, no dependency.
 */
const DB = 'reclaim'
const STORE = 'reports'

export interface StoredReport {
  mountId: string
  at: number
  report: ScanReport
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'mountId' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const request = run(db.transaction(STORE, mode).objectStore(STORE))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  }).finally(() => db.close())
}

export async function saveReport(mountId: string, report: ScanReport): Promise<void> {
  try {
    await tx('readwrite', (store) => store.put({ mountId, at: Date.now(), report }))
  } catch {
    // History is a convenience. A private window that refuses storage is fine.
  }
}

export async function loadReports(): Promise<StoredReport[]> {
  try {
    const all = await tx<StoredReport[]>('readonly', (store) => store.getAll())
    return all.sort((a, b) => b.at - a.at)
  } catch {
    return []
  }
}
