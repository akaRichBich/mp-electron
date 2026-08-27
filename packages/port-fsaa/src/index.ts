import {
  paths,
  PortUnsupported,
  SHELL_CAPABILITIES,
  type FsEntry,
  type FsPort,
  type LogicalPath,
  type WalkOptions,
} from '@mp/core'

/**
 * The PWA port, on top of the File System Access API.
 *
 * Two honest differences from the desktop port, both visible in `capabilities`
 * rather than hidden in the UI:
 *
 *  - `canScanWithoutPicker: false` - the browser only ever hands us the one
 *    folder the user picked, so rules outside it are reported as skipped.
 *  - `canDelete: false` - a product decision, not an API limit. The web build
 *    is a read-only preview; `removeEntry()` would work with a readwrite grant,
 *    and enabling it is a deliberate change to this file, not a config flag.
 */
export class FsaaFsPort implements FsPort {
  readonly id = 'fsaa'
  readonly capabilities = SHELL_CAPABILITIES.web

  /**
   * @param root   the directory handle from `showDirectoryPicker()`
   * @param mount  the logical path that handle stands for, e.g. `~/Library/Caches`
   */
  constructor(
    private readonly root: FileSystemDirectoryHandle,
    private readonly mount: LogicalPath,
  ) {}

  mounts(): readonly LogicalPath[] {
    return [this.mount]
  }

  async stat(path: LogicalPath): Promise<FsEntry | null> {
    const handle = await this.resolve(path)
    if (!handle) return null
    return handle.kind === 'directory'
      ? { path, kind: 'dir', size: 0, mtimeMs: 0 }
      : await fileEntry(path, handle as FileSystemFileHandle)
  }

  async *list(path: LogicalPath): AsyncIterable<FsEntry> {
    yield* this.walk(path, { maxDepth: 1 })
  }

  async *walk(path: LogicalPath, opts: WalkOptions = {}): AsyncIterable<FsEntry> {
    const start = await this.resolve(path)
    if (!start || start.kind !== 'directory') return
    const maxDepth = opts.maxDepth ?? Infinity
    const queue: Array<{ handle: FileSystemDirectoryHandle; logical: LogicalPath; depth: number }> = [
      { handle: start as FileSystemDirectoryHandle, logical: path, depth: 0 },
    ]
    while (queue.length > 0) {
      const current = queue.shift()!
      const childDepth = current.depth + 1
      for await (const [name, handle] of current.handle.entries()) {
        const logical = `${current.logical}/${name}`
        if (handle.kind === 'directory') {
          if (childDepth <= maxDepth) yield { path: logical, kind: 'dir', size: 0, mtimeMs: 0 }
          if (childDepth < maxDepth) {
            queue.push({ handle: handle as FileSystemDirectoryHandle, logical, depth: childDepth })
          }
        } else if (childDepth <= maxDepth) {
          yield await fileEntry(logical, handle as FileSystemFileHandle)
        }
      }
    }
  }

  /**
   * Escalate to readwrite. Must be called from a user gesture - the browser
   * ignores a permission request that no click asked for.
   */
  async requestWriteAccess(): Promise<boolean> {
    const handle = this.root as FileSystemDirectoryHandle & {
      queryPermission?: (options: { mode: string }) => Promise<PermissionState>
      requestPermission?: (options: { mode: string }) => Promise<PermissionState>
    }
    if (!handle.queryPermission || !handle.requestPermission) return false
    if ((await handle.queryPermission({ mode: 'readwrite' })) === 'granted') return true
    return (await handle.requestPermission({ mode: 'readwrite' })) === 'granted'
  }

  async remove(path: LogicalPath): Promise<void> {
    if (!paths.isUnder(path, this.mount) || path === this.mount) {
      throw new PortUnsupported(this.id, `remove outside the picked folder (${path})`)
    }
    const relative = paths.relative(this.mount, path)
    const segments = relative.split('/')
    const name = segments.pop()!

    let parent: FileSystemDirectoryHandle = this.root
    for (const segment of segments) parent = await parent.getDirectoryHandle(segment)

    await parent.removeEntry(name, { recursive: true })
  }

  private async resolve(path: LogicalPath): Promise<FileSystemHandle | null> {
    if (!paths.isUnder(path, this.mount)) return null
    const rest = paths.relative(this.mount, path)
    let handle: FileSystemDirectoryHandle = this.root
    const segments = rest ? rest.split('/') : []
    for (let i = 0; i < segments.length; i++) {
      const name = segments[i]!
      const last = i === segments.length - 1
      try {
        handle = await handle.getDirectoryHandle(name)
      } catch {
        if (!last) return null
        return await handle.getFileHandle(name).catch(() => null)
      }
    }
    return handle
  }
}

async function fileEntry(path: LogicalPath, handle: FileSystemFileHandle): Promise<FsEntry> {
  const file = await handle.getFile()
  return { path, kind: 'file', size: file.size, mtimeMs: file.lastModified }
}
