import { opendir, rm, stat as fsStat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join as joinNative, sep } from 'node:path'
import { SHELL_CAPABILITIES, type FsEntry, type FsPort, type LogicalPath, type WalkOptions } from '@mp/core'

/**
 * The Electron-side port. Everything the desktop shell can do that a browser
 * cannot is declared in `capabilities` - the UI branches on those, never on
 * `process.platform` or `isElectron`.
 */
export class NodeFsPort implements FsPort {
  readonly id = 'node'
  readonly capabilities = SHELL_CAPABILITIES.desktop

  constructor(private readonly home: string = homedir()) {}

  mounts(): readonly LogicalPath[] {
    return ['~']
  }

  async stat(path: LogicalPath): Promise<FsEntry | null> {
    const real = this.toReal(path)
    try {
      const info = await fsStat(real)
      return {
        path,
        kind: info.isDirectory() ? 'dir' : 'file',
        size: info.isDirectory() ? 0 : info.size,
        mtimeMs: info.mtimeMs,
      }
    } catch {
      return null
    }
  }

  async *list(path: LogicalPath): AsyncIterable<FsEntry> {
    yield* this.walk(path, { maxDepth: 1 })
  }

  async *walk(path: LogicalPath, opts: WalkOptions = {}): AsyncIterable<FsEntry> {
    const maxDepth = opts.maxDepth ?? Infinity
    // Depth is measured from `path`: its direct children are depth 1.
    const queue: Array<{ logical: LogicalPath; depth: number }> = [{ logical: path, depth: 0 }]
    while (queue.length > 0) {
      const current = queue.shift()!
      let dir
      try {
        dir = await opendir(this.toReal(current.logical))
      } catch {
        continue // an unreadable directory is a normal condition, not a scan failure
      }
      const childDepth = current.depth + 1
      for await (const dirent of dir) {
        if (dirent.isSymbolicLink()) continue // never follow a link out of the allowlist
        const logical = `${current.logical}/${dirent.name}`
        if (dirent.isDirectory()) {
          if (childDepth <= maxDepth) {
            yield { path: logical, kind: 'dir', size: 0, mtimeMs: await mtimeOf(this.toReal(logical)) }
          }
          if (childDepth < maxDepth) queue.push({ logical, depth: childDepth })
        } else if (dirent.isFile() && childDepth <= maxDepth) {
          const info = await fsStat(this.toReal(logical)).catch(() => null)
          if (info) yield { path: logical, kind: 'file', size: info.size, mtimeMs: info.mtimeMs }
        }
      }
    }
  }

  async remove(path: LogicalPath): Promise<void> {
    await rm(this.toReal(path), { recursive: true, force: true })
  }

  /** Node-only escape hatch: the real path, for `shell.showItemInFolder`. */
  realPath(path: LogicalPath): string {
    return this.toReal(path)
  }

  private toReal(path: LogicalPath): string {
    if (!path.startsWith('~')) throw new Error(`not a logical path: ${path}`)
    const tail = path.slice(2)
    return tail ? joinNative(this.home, ...tail.split('/')) : this.home + sep
  }
}

async function mtimeOf(real: string): Promise<number> {
  return (await fsStat(real).catch(() => null))?.mtimeMs ?? 0
}
