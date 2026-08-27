import type { FsPort, LogicalPath } from '../ports/fs-port'

export interface Measurement {
  bytes: number
  entries: number
  /**
   * Newest mtime among the files inside. Age is decided by content, never by
   * the directory's own stamp: the OS sets that when an entry is added, and a
   * fixture in memory has no such stamp at all - so relying on it made the
   * fake and node ports disagree about the same tree.
   */
  newestMtimeMs: number
}

export async function measure(port: FsPort, path: LogicalPath): Promise<Measurement> {
  let bytes = 0
  let entries = 0
  let newestMtimeMs = 0
  for await (const entry of port.walk(path)) {
    if (entry.kind !== 'file') continue
    bytes += entry.size
    entries++
    if (entry.mtimeMs > newestMtimeMs) newestMtimeMs = entry.mtimeMs
  }
  return { bytes, entries, newestMtimeMs }
}
