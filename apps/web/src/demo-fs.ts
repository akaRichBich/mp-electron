import { FsaaFsPort } from '@mp/port-fsaa'
import type { LogicalPath } from '@mp/core'

/**
 * A sandbox built on the Origin Private File System.
 *
 * `showDirectoryPicker()` is Chromium-only and asks for access to real folders.
 * OPFS is in every modern browser, needs no permission, and hands back an
 * ordinary `FileSystemDirectoryHandle` - so the exact same `FsaaFsPort`, engine
 * and rules run over it. It is how someone can watch a deletion happen without
 * granting this page anything at all.
 */
export const DEMO_MOUNT: LogicalPath = '~/Library/Caches'

const TREE: Record<string, number> = {
  'ReclaimSandbox/test.txt': 0,
  'ReclaimSandbox/sample.bin': 2_000_000,
  'Homebrew/downloads/node--22.tar.gz': 6_000_000,
  'Homebrew/downloads/ffmpeg--7.1.tar.gz': 4_400_000,
  'Homebrew/api/formula.jws.json': 900_000,
  'pip/wheels/numpy-2.1.3.whl': 1_500_000,
  'pip/http-v2/0/1/body': 320_000,
}

export function demoSupported(): boolean {
  return typeof navigator !== 'undefined' && 'storage' in navigator && 'getDirectory' in navigator.storage
}

/** Rebuild the tree from scratch, so "scan again" after a delete is honest. */
export async function openDemoSandbox(options: { reset: boolean }): Promise<FsaaFsPort> {
  const opfs = await navigator.storage.getDirectory()

  if (options.reset) {
    await opfs.removeEntry('Caches', { recursive: true }).catch(() => undefined)
  }

  const caches = await opfs.getDirectoryHandle('Caches', { create: true })

  if (options.reset) {
    for (const [path, size] of Object.entries(TREE)) {
      const segments = path.split('/')
      const name = segments.pop()!
      let dir = caches
      for (const segment of segments) dir = await dir.getDirectoryHandle(segment, { create: true })
      const file = await dir.getFileHandle(name, { create: true })
      const writable = await file.createWritable()
      if (size > 0) await writable.write(new Uint8Array(size))
      await writable.close()
    }
  }

  return new FsaaFsPort(caches, DEMO_MOUNT)
}
