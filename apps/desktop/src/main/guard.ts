import { checkPath, type Finding } from '@mp/core'

export interface Partition {
  allowed: string[]
  refused: string[]
  bytes: number
}

/**
 * The renderer is not trusted with paths. A path may only be removed if it
 * appears in the report main itself produced *and* still passes the allowlist -
 * so neither a compromised renderer nor a stale report can widen the blast
 * radius. Everything else is refused and reported back.
 */
export function partitionRemovable(paths: readonly string[], findings: readonly Finding[]): Partition {
  const known = new Map(findings.map((finding) => [finding.path, finding]))
  const allowed: string[] = []
  const refused: string[] = []

  for (const path of paths) {
    if (known.has(path) && checkPath(path).ok) allowed.push(path)
    else refused.push(path)
  }

  return {
    allowed,
    refused,
    bytes: allowed.reduce((sum, path) => sum + (known.get(path)?.bytes ?? 0), 0),
  }
}
