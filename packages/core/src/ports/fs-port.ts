/**
 * The platform port. `core` talks only to this interface and never to a
 * filesystem API. Three implementations exist:
 *
 *   FakeFsPort   (here, in core)      - in-memory tree, used by tests + eval
 *   NodeFsPort   (@mp/port-node)      - node:fs, used by the Electron shell
 *   FsaaFsPort   (@mp/port-fsaa)      - File System Access API, used by the PWA
 *
 * Anything a platform cannot do is expressed through `capabilities`, not
 * through the UI sniffing which shell it is running in.
 */

/** Always `~`-rooted and `/`-separated, e.g. `~/Library/Caches/pip`. */
export type LogicalPath = string

export interface FsEntry {
  path: LogicalPath
  kind: 'file' | 'dir'
  /** Bytes. Always 0 for directories - use `measure()` to size a subtree. */
  size: number
  mtimeMs: number
}

export interface PortCapabilities {
  /** Can physically delete an entry. The PWA deliberately cannot. */
  canDelete: boolean
  /** Can reach any path under $HOME without the user picking a folder first. */
  canScanWithoutPicker: boolean
  /** Can keep scanning with no window open (tray / background). */
  canRunInBackground: boolean
}

export interface WalkOptions {
  maxDepth?: number
}

export interface FsPort {
  readonly id: string
  readonly capabilities: PortCapabilities
  /**
   * Path prefixes this port can currently serve. A rule that falls outside
   * every mount is *skipped with a reason*, never reported as a failure -
   * that is the normal case in the PWA, where the user picked one folder.
   */
  mounts(): readonly LogicalPath[]
  stat(path: LogicalPath): Promise<FsEntry | null>
  list(path: LogicalPath): AsyncIterable<FsEntry>
  walk(path: LogicalPath, opts?: WalkOptions): AsyncIterable<FsEntry>
  remove(path: LogicalPath): Promise<void>
}

export class PortUnsupported extends Error {
  constructor(readonly portId: string, readonly operation: string) {
    super(`Port "${portId}" does not support ${operation}`)
    this.name = 'PortUnsupported'
  }
}
