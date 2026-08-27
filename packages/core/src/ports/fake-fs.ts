import { isUnder, normalize } from '../util/path'
import type { FsEntry, FsPort, LogicalPath, PortCapabilities, WalkOptions } from './fs-port'

/** Frozen clock so a scan over a fixture is byte-for-byte reproducible in CI. */
export const FIXTURE_NOW = Date.UTC(2026, 0, 1)

export interface Fixture {
  name: string
  /** path -> size in bytes, or `{ size, ageDays }` when age matters to a rule. */
  files: Record<string, number | { size: number; ageDays?: number }>
}

/**
 * The third port. It exists because it makes the whole system testable without
 * a Mac, a disk, or a UI - which is what lets an agent's generated rule be
 * verified in CI in seconds.
 */
export class FakeFsPort implements FsPort {
  readonly id = 'fake'
  readonly capabilities: PortCapabilities = {
    canDelete: true,
    canScanWithoutPicker: true,
    canRunInBackground: true,
  }

  private readonly entries = new Map<string, FsEntry>()

  constructor(fixture: Fixture, private readonly now: number = FIXTURE_NOW) {
    for (const [rawPath, value] of Object.entries(fixture.files)) {
      const path = normalize(rawPath)
      const size = typeof value === 'number' ? value : value.size
      const ageDays = typeof value === 'number' ? 0 : (value.ageDays ?? 0)
      const mtimeMs = this.now - ageDays * 86_400_000
      this.entries.set(path, { path, kind: 'file', size, mtimeMs })
      for (const dir of ancestors(path)) {
        const known = this.entries.get(dir)
        if (!known) this.entries.set(dir, { path: dir, kind: 'dir', size: 0, mtimeMs })
        else if (known.kind === 'dir' && mtimeMs > known.mtimeMs) known.mtimeMs = mtimeMs
      }
    }
  }

  mounts(): readonly LogicalPath[] {
    return ['~']
  }

  async stat(path: LogicalPath): Promise<FsEntry | null> {
    return this.entries.get(normalize(path)) ?? null
  }

  async *list(path: LogicalPath): AsyncIterable<FsEntry> {
    yield* this.walk(path, { maxDepth: 1 })
  }

  async *walk(path: LogicalPath, opts: WalkOptions = {}): AsyncIterable<FsEntry> {
    const root = normalize(path)
    const maxDepth = opts.maxDepth ?? Infinity
    for (const entry of [...this.entries.values()].sort((a, b) => a.path.localeCompare(b.path))) {
      if (entry.path === root || !isUnder(entry.path, root)) continue
      const depth = entry.path.slice(root.length + 1).split('/').length
      if (depth > maxDepth) continue
      yield entry
    }
  }

  async remove(path: LogicalPath): Promise<void> {
    const root = normalize(path)
    for (const key of [...this.entries.keys()]) {
      if (key === root || isUnder(key, root)) this.entries.delete(key)
    }
  }

  /** Test helper: what is still on the fake disk. */
  snapshot(): string[] {
    return [...this.entries.values()]
      .filter((e) => e.kind === 'file')
      .map((e) => e.path)
      .sort()
  }
}

function ancestors(path: string): string[] {
  const parts = path.split('/')
  const out: string[] = []
  for (let i = parts.length - 1; i > 0; i--) out.push(parts.slice(0, i).join('/'))
  return out
}
