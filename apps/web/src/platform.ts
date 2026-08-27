import { FsaaFsPort } from '@mp/port-fsaa'
import type { LogicalPath } from '@mp/core'

declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      id?: string
      mode?: 'read' | 'readwrite'
      startIn?: string
    }) => Promise<FileSystemDirectoryHandle>
  }
}

export interface Mount {
  id: string
  label: string
  path: LogicalPath
  /** Folder name we expect the user to land on, used only to warn them. */
  expect: string
  hint: string
}

/**
 * The browser hands us exactly one folder, so the shell asks which one it is.
 * Everything outside the chosen mount comes back from the scan as `skipped`
 * with a reason - the engine treats that as a normal outcome, not an error.
 */
export const MOUNTS: Mount[] = [
  {
    id: 'caches',
    label: 'Caches',
    path: '~/Library/Caches',
    expect: 'Caches',
    hint: 'Homebrew, pip, Poetry and friends',
  },
  {
    id: 'derived-data',
    label: 'DerivedData',
    path: '~/Library/Developer/Xcode/DerivedData',
    expect: 'DerivedData',
    hint: 'Xcode build intermediates, per project',
  },
  {
    id: 'logs',
    label: 'Logs',
    path: '~/Library/Logs',
    expect: 'Logs',
    hint: 'Diagnostic reports and app logs',
  },
]

export function pickerSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
}

export interface Picked {
  port: FsaaFsPort
  mount: Mount
  /** True when the folder name does not look like the mount that was asked for. */
  mismatch: boolean
}

export async function pickMount(mount: Mount): Promise<Picked | null> {
  if (!window.showDirectoryPicker) return null
  let handle: FileSystemDirectoryHandle
  try {
    handle = await window.showDirectoryPicker({ id: mount.id, mode: 'read' })
  } catch {
    return null // the user dismissed the picker; not an error worth showing
  }
  return {
    port: new FsaaFsPort(handle, mount.path),
    mount,
    mismatch: handle.name !== mount.expect,
  }
}
