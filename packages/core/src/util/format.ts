const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

export interface Scale {
  divisor: number
  unit: string
  decimals: number
}

/** The scale is chosen once from the final figure, so a counting animation
 *  cannot flip the unit label halfway through. */
export function scaleFor(bytes: number): Scale {
  let n = bytes
  let index = 0
  while (n >= 1000 && index < UNITS.length - 1) {
    n /= 1000
    index++
  }
  return {
    divisor: 1000 ** index,
    unit: UNITS[index]!,
    decimals: index === 0 ? 0 : n >= 100 ? 0 : n >= 10 ? 1 : 2,
  }
}

export function applyScale(bytes: number, scale: Scale): string {
  return (bytes / scale.divisor).toFixed(scale.decimals)
}

export function formatBytes(bytes: number): string {
  const scale = scaleFor(bytes)
  return `${applyScale(bytes, scale)} ${scale.unit}`
}

export function shortPath(path: string, keep = 3): string {
  const parts = path.split('/')
  return parts.length <= keep + 1 ? path : `…/${parts.slice(-keep).join('/')}`
}
