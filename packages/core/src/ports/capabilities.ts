import type { PortCapabilities } from './fs-port'

/**
 * What each shell can do, in one table.
 *
 * The ports import their own row rather than declaring capabilities inline, and
 * a test asserts they match - so the matrix a user sees in the UI cannot drift
 * away from what the port actually does.
 */
export const SHELL_CAPABILITIES = {
  web: {
    canDelete: false,
    canScanWithoutPicker: false,
    canRunInBackground: false,
  },
  desktop: {
    canDelete: true,
    canScanWithoutPicker: true,
    canRunInBackground: true,
  },
} as const satisfies Record<'web' | 'desktop', PortCapabilities>

export type ShellName = keyof typeof SHELL_CAPABILITIES

/** Labels for the capability matrix, in the order it reads best. */
export const CAPABILITY_LABELS: Array<{ key: keyof PortCapabilities; label: string }> = [
  { key: 'canDelete', label: 'delete in place' },
  { key: 'canScanWithoutPicker', label: 'no folder picker' },
  { key: 'canRunInBackground', label: 'background scans' },
]
