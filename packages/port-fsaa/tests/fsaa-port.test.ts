import { describe, expect, it } from 'vitest'
import fixture from '@mp/core/fixtures/mac-dev-home.json'
import { FIXTURE_NOW, FakeFsPort, PortUnsupported, allRules, scan, type Fixture } from '@mp/core'
import { FsaaFsPort } from '../src/index'

const typed = fixture as Fixture
const MOUNT = '~/Library/Caches'

/* A File System Access handle, small enough to read in one sitting. The port
 * has no other way to be exercised: the real API needs an OS picker dialog. */

class FakeFile {
  readonly kind = 'file' as const
  constructor(
    readonly name: string,
    private readonly size: number,
    private readonly lastModified: number,
  ) {}
  async getFile() {
    return { size: this.size, lastModified: this.lastModified }
  }
}

class FakeDir {
  readonly kind = 'directory' as const
  readonly children = new Map<string, FakeDir | FakeFile>()
  constructor(readonly name: string) {}

  async *entries(): AsyncIterableIterator<[string, FakeDir | FakeFile]> {
    for (const entry of this.children) yield entry
  }

  async getDirectoryHandle(name: string): Promise<FakeDir> {
    const child = this.children.get(name)
    if (!child || child.kind !== 'directory') throw new Error('NotFoundError')
    return child
  }

  async getFileHandle(name: string): Promise<FakeFile> {
    const child = this.children.get(name)
    if (!child || child.kind !== 'file') throw new Error('NotFoundError')
    return child
  }
}

/** Build the part of the fixture that lives under `mount`, as handles. */
function mountedHandle(mount: string = MOUNT): FileSystemDirectoryHandle {
  const root = new FakeDir(mount.split('/').at(-1)!)
  for (const [logical, value] of Object.entries(typed.files)) {
    if (!logical.startsWith(`${mount}/`)) continue
    const size = typeof value === 'number' ? value : value.size
    const ageDays = typeof value === 'number' ? 0 : (value.ageDays ?? 0)
    const segments = logical.slice(mount.length + 1).split('/')
    let dir = root
    for (const segment of segments.slice(0, -1)) {
      let next = dir.children.get(segment)
      if (!next || next.kind !== 'directory') {
        next = new FakeDir(segment)
        dir.children.set(segment, next)
      }
      dir = next
    }
    const leaf = segments.at(-1)!
    dir.children.set(leaf, new FakeFile(leaf, size, FIXTURE_NOW - ageDays * 86_400_000))
  }
  return root as unknown as FileSystemDirectoryHandle
}

const port = (mount: string = MOUNT) => new FsaaFsPort(mountedHandle(mount), mount)

describe('FsaaFsPort', () => {
  it('walks the picked folder and matches the fake port over the same mount', async () => {
    const web = await scan(port(), allRules(), { now: FIXTURE_NOW })

    const reference = new FakeFsPort(typed)
    Object.defineProperty(reference, 'mounts', { value: () => [MOUNT] })
    const expected = await scan(reference, allRules(), { now: FIXTURE_NOW })

    expect(web.findings.map((f) => `${f.ruleId}:${f.path}:${f.bytes}`)).toEqual(
      expected.findings.map((f) => `${f.ruleId}:${f.path}:${f.bytes}`),
    )
  })

  it('skips rules outside the picked folder rather than failing', async () => {
    const report = await scan(port(), allRules(), { now: FIXTURE_NOW })
    expect(report.skipped.map((s) => s.ruleId)).toContain('xcode-derived-data')
    expect(report.skipped.find((s) => s.ruleId === 'xcode-derived-data')?.reason).toContain(
      'outside the mounts',
    )
  })

  it('reports that it cannot delete, and refuses when asked', async () => {
    expect(port().capabilities.canDelete).toBe(false)
    await expect(port().remove('~/Library/Caches/pip')).rejects.toBeInstanceOf(PortUnsupported)
  })

  it('does not reach outside its mount', async () => {
    expect(await port().stat('~/Documents/thesis.pdf')).toBeNull()
  })

  it('matches a glob rooted at the mount itself', async () => {
    // `stale-app-logs` globs directly on ~/Library/Logs, which is the picked
    // folder - so resolving the empty relative path has to return the root.
    const logs = '~/Library/Logs'
    const report = await scan(port(logs), allRules(), { now: FIXTURE_NOW })
    expect(report.findings.map((f) => f.path)).toEqual(['~/Library/Logs/DiagnosticReports'])
  })
})
