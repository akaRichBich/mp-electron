import { isUnder, globToRegExp, relative } from '../util/path'
import type { FsPort, LogicalPath } from '../ports/fs-port'
import type { Matcher, Rule } from '../rule/schema'
import { measure } from './measure'
import type { Finding, ScanOptions, ScanReport, SkippedRule } from './types'

const DAY_MS = 86_400_000

function reachable(port: FsPort, path: LogicalPath): boolean {
  return port.mounts().some((mount) => isUnder(path, mount) || isUnder(mount, path))
}

function matcherRoot(matcher: Matcher): LogicalPath {
  return matcher.kind === 'dir' ? matcher.path : matcher.root
}

export async function scan(port: FsPort, rules: Rule[], opts: ScanOptions = {}): Promise<ScanReport> {
  const now = opts.now ?? Date.now()
  const findings: Finding[] = []
  const skipped: SkippedRule[] = []

  const planned = rules.filter((rule) => !opts.onlyRules || opts.onlyRules.includes(rule.id))

  for (const [index, rule] of planned.entries()) {
    opts.onProgress?.({ done: index, total: planned.length, ruleId: rule.id })

    const roots = rule.matchers.map(matcherRoot)
    if (!roots.some((root) => reachable(port, root))) {
      skipped.push({ ruleId: rule.id, reason: `outside the mounts of port "${port.id}"` })
      continue
    }

    const before = findings.length
    for (const matcher of rule.matchers) {
      for await (const hit of matchEntries(port, matcher)) {
        const { bytes, entries, newestMtimeMs } =
          hit.kind === 'dir'
            ? await measure(port, hit.path)
            : { bytes: hit.size, entries: 1, newestMtimeMs: hit.mtimeMs }
        if (entries === 0) continue
        if (rule.minAgeDays !== undefined && now - newestMtimeMs < rule.minAgeDays * DAY_MS) continue
        findings.push({
          ruleId: rule.id,
          title: rule.title,
          safety: rule.safety,
          explain: rule.explain,
          path: hit.path,
          bytes,
          entries,
        })
      }
    }
    if (findings.length === before) {
      skipped.push({ ruleId: rule.id, reason: 'nothing matched' })
    }
  }

  findings.sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path))

  return {
    portId: port.id,
    capabilities: port.capabilities,
    findings,
    skipped,
    totalBytes: findings.reduce((sum, f) => sum + f.bytes, 0),
  }
}

async function* matchEntries(port: FsPort, matcher: Matcher) {
  if (matcher.kind === 'dir') {
    const entry = await port.stat(matcher.path)
    if (entry) yield entry
    return
  }
  const re = globToRegExp(matcher.pattern)
  for await (const entry of port.walk(matcher.root)) {
    if (re.test(relative(matcher.root, entry.path))) yield entry
  }
}
