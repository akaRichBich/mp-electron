export function normalize(path: string): string {
  return path.replace(/\/+/g, '/').replace(/\/$/, '')
}

export function isUnder(path: string, prefix: string): boolean {
  const p = normalize(path)
  const q = normalize(prefix)
  return p === q || p.startsWith(q + '/')
}

export function join(...parts: string[]): string {
  return normalize(parts.filter(Boolean).join('/'))
}

export function basename(path: string): string {
  const parts = normalize(path).split('/')
  return parts[parts.length - 1] ?? ''
}

export function relative(root: string, path: string): string {
  const r = normalize(root)
  const p = normalize(path)
  return p === r ? '' : p.slice(r.length + 1)
}

/** Tiny glob: `*` = one segment, `**` = any depth, `?` = one char. */
export function globToRegExp(pattern: string): RegExp {
  let out = '^'
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]!
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        i++
        if (pattern[i + 1] === '/') i++
        out += '(?:.*\\/)?'
      } else {
        out += '[^/]*'
      }
    } else if (c === '?') {
      out += '[^/]'
    } else {
      out += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    }
  }
  return new RegExp(out + '$')
}
