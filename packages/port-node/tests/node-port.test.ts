import { mkdtemp, mkdir, writeFile, utimes } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import fixture from '@mp/core/fixtures/mac-dev-home.json'
import { FIXTURE_NOW, FakeFsPort, allRules, scan, type Fixture } from '@mp/core'
import { NodeFsPort } from '../src/index'

const typed = fixture as Fixture
let home: string

/** Materialise the fixture on a real disk, rooted at a throwaway $HOME. */
beforeAll(async () => {
  home = await mkdtemp(join(tmpdir(), 'mp-port-'))
  for (const [logical, value] of Object.entries(typed.files)) {
    const size = typeof value === 'number' ? value : value.size
    const ageDays = typeof value === 'number' ? 0 : (value.ageDays ?? 0)
    const real = join(home, ...logical.slice(2).split('/'))
    await mkdir(dirname(real), { recursive: true })
    await writeFile(real, Buffer.alloc(Math.min(size, 4096)))
    const mtime = new Date(FIXTURE_NOW - ageDays * 86_400_000)
    await utimes(real, mtime, mtime)
  }
})

describe('NodeFsPort', () => {
  it('reports the same findings as the fake port', async () => {
    const onDisk = await scan(new NodeFsPort(home), allRules(), { now: FIXTURE_NOW })
    const inMemory = await scan(new FakeFsPort(typed), allRules(), { now: FIXTURE_NOW })
    // Byte counts differ (files are truncated on disk); the shape must not.
    expect(onDisk.findings.map((f) => `${f.ruleId}:${f.path}`).sort()).toEqual(
      inMemory.findings.map((f) => `${f.ruleId}:${f.path}`).sort(),
    )
  })

  it('deletes what it found', async () => {
    const port = new NodeFsPort(home)
    expect(await port.stat('~/Library/Caches/pip')).not.toBeNull()
    await port.remove('~/Library/Caches/pip')
    expect(await port.stat('~/Library/Caches/pip')).toBeNull()
  })
})
