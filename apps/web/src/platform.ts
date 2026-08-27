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
  /**
   * True for the OPFS sandbox. Its findings carry real-looking paths so the
   * real rules apply to them - which makes saying so, loudly and everywhere,
   * a correctness requirement rather than a nicety.
   */
  simulated?: boolean
  /**
   * Chromium blocks `~/Library` and everything under it for the File System
   * Access API (`kBlockAllChildren` in chrome_file_system_access_permission_context.cc),
   * so the picker will refuse these however the user answers the dialog. Left
   * in the list because the honest answer is "this is what the desktop app is
   * for", not a shorter list that pretends the problem away.
   */
  blockedByBrowser?: boolean
}

/**
 * The browser hands us exactly one folder, so the shell asks which one it is.
 * Everything outside the chosen mount comes back from the scan as `skipped`
 * with a reason - the engine treats that as a normal outcome, not an error.
 */
export const MOUNTS: Mount[] = [
  {
    id: 'npm-cache',
    label: 'npm cache',
    path: '~/.npm/_cacache',
    expect: '_cacache',
    hint: 'outside ~/Library, so the browser will hand it over',
  },
  {
    id: 'caches',
    blockedByBrowser: true,
    label: 'Caches',
    path: '~/Library/Caches',
    expect: 'Caches',
    hint: 'Homebrew, pip, Poetry and friends',
  },
  {
    id: 'derived-data',
    blockedByBrowser: true,
    label: 'DerivedData',
    path: '~/Library/Developer/Xcode/DerivedData',
    expect: 'DerivedData',
    hint: 'Xcode build intermediates, per project',
  },
  {
    id: 'logs',
    blockedByBrowser: true,
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

export type PickOutcome =
  | { kind: 'picked'; picked: Picked }
  | { kind: 'cancelled' }
  | { kind: 'failed'; message: string }

export async function pickMount(mount: Mount): Promise<PickOutcome> {
  if (!window.showDirectoryPicker) return { kind: 'cancelled' }

  let handle: FileSystemDirectoryHandle
  try {
    handle = await window.showDirectoryPicker({ id: mount.id, mode: 'read' })
  } catch (error) {
    // AbortError is the user closing the dialog. Anything else - a blocked
    // directory, most likely - is a refusal they deserve to hear about.
    if (error instanceof DOMException && error.name === 'AbortError') return { kind: 'cancelled' }
    return { kind: 'failed', message: error instanceof Error ? error.message : String(error) }
  }

  return {
    kind: 'picked',
    picked: {
      port: new FsaaFsPort(handle, mount.path),
      mount,
      mismatch: handle.name !== mount.expect,
    },
  }
}
