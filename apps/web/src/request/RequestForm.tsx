import { useMemo, useState } from 'react'
import { ALLOWED_PREFIXES } from '@mp/core'
import { RuleSpec, ruleIdFor } from '@mp/harness/spec'

/**
 * The whole point of the spec being a schema rather than a prompt: a person who
 * writes no TypeScript can produce a request that is already valid, and be told
 * *why* before anything is generated.
 *
 * It exports a file. Making the branch and the pull request is deliberately not
 * here - that is the part that is not built, and pretending otherwise would be
 * the one dishonest thing in this repository.
 */

const CATEGORIES = ['cache', 'logs', 'build-artifacts', 'package-manager'] as const

const EXAMPLE = {
  what: 'Go build cache',
  paths: ['~/Library/Caches/go-build'],
  explain: 'Compiled Go packages kept between builds. The next `go build` recreates what it needs.',
  category: 'build-artifacts' as const,
  requestedBy: 'qa@example.com',
}

function starterSizes(index: number): number {
  return [41_000_000, 6_500_000][index % 2]!
}

export function RequestForm({ onBack }: { onBack: () => void }) {
  const [what, setWhat] = useState('')
  const [paths, setPaths] = useState<string[]>([''])
  const [match, setMatch] = useState<'whole-folder' | 'by-pattern'>('whole-folder')
  const [pattern, setPattern] = useState('*')
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('cache')
  const [safety, setSafety] = useState<'safe' | 'review'>('safe')
  const [explain, setExplain] = useState('')
  const [minAgeDays, setMinAgeDays] = useState('')
  const [requestedBy, setRequestedBy] = useState('')
  const [sizes, setSizes] = useState<Record<string, number>>({})
  const [copied, setCopied] = useState(false)

  // Sample data is required, and inventing plausible file paths is not a thing
  // to ask a PM for - so it is derived from the folders they named.
  const fixtureKeys = useMemo(
    () => paths.filter(Boolean).flatMap((path) => [`${path}/sample-1.bin`, `${path}/sample-2.bin`]),
    [paths],
  )

  const files = Object.fromEntries(
    fixtureKeys.map((key, index) => [key, sizes[key] ?? starterSizes(index)]),
  )

  const spec = {
    what,
    paths: paths.filter(Boolean),
    match,
    ...(match === 'by-pattern' ? { pattern } : {}),
    category,
    safety,
    explain,
    ...(minAgeDays.trim() ? { minAgeDays: Number(minAgeDays) } : {}),
    fixture: { files },
    requestedBy,
  }

  const parsed = RuleSpec.safeParse(spec)
  const issuesFor = (field: string) =>
    parsed.success
      ? []
      : parsed.error.issues.filter((issue) => String(issue.path[0] ?? '') === field)

  const json = JSON.stringify(spec, null, 2)
  const id = what.trim() ? ruleIdFor({ what }) : 'your-rule'

  function loadExample() {
    setWhat(EXAMPLE.what)
    setPaths([...EXAMPLE.paths])
    setCategory(EXAMPLE.category)
    setExplain(EXAMPLE.explain)
    setRequestedBy(EXAMPLE.requestedBy)
    setSafety('safe')
    setMatch('whole-folder')
    setMinAgeDays('')
    setSizes({})
  }

  function download() {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${id}.spec.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="request">
      <div className="request-form">
        <button className="linkish" onClick={onBack}>
          ← back to the report
        </button>

        <h1 className="title request-title">Request a cleanup rule</h1>
        <p className="lede">
          The only thing someone who writes no code can add to this app. Nothing here is a prompt —
          it is a schema, so a request that cannot be built is refused now rather than reviewed
          later.
        </p>

        <p>
          <button className="button" data-variant="quiet" onClick={loadExample}>
            fill in a worked example
          </button>
        </p>

        <label className="field">
          <span>What are we looking for?</span>
          <input value={what} onChange={(event) => setWhat(event.target.value)} placeholder="Go build cache" />
          <em>Becomes the row title, and the rule id: {id}</em>
          <Issues list={issuesFor('what')} />
        </label>

        <div className="field">
          <span>Where?</span>
          {paths.map((path, index) => (
            <input
              key={index}
              value={path}
              placeholder="~/Library/Caches/…"
              onChange={(event) =>
                setPaths(paths.map((old, i) => (i === index ? event.target.value : old)))
              }
            />
          ))}
          <div className="field-row">
            <button className="button" data-variant="quiet" onClick={() => setPaths([...paths, ''])}>
              add another
            </button>
            {paths.length > 1 && (
              <button className="button" data-variant="quiet" onClick={() => setPaths(paths.slice(0, -1))}>
                remove last
              </button>
            )}
          </div>
          <em>Allowed: {ALLOWED_PREFIXES.join(', ')}</em>
          <Issues list={issuesFor('paths')} />
        </div>

        <div className="field">
          <span>Match</span>
          <div className="field-row">
            <Choice name="match" value="whole-folder" current={match} onPick={setMatch} label="the whole folder" />
            <Choice name="match" value="by-pattern" current={match} onPick={setMatch} label="by pattern" />
          </div>
          {match === 'by-pattern' && (
            <input value={pattern} onChange={(event) => setPattern(event.target.value)} placeholder="*" />
          )}
          <Issues list={issuesFor('pattern')} />
        </div>

        <div className="field">
          <span>Safety</span>
          <div className="field-row">
            <Choice name="safety" value="safe" current={safety} onPick={setSafety} label="safe to remove" />
            <Choice name="safety" value="review" current={safety} onPick={setSafety} label="worth a look first" />
          </div>
          <em>
            There is a third level, <code>dangerous</code>, and this form cannot choose it — that one
            needs an engineer.
          </em>
        </div>

        <label className="field">
          <span>Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>
            {CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>What does the user lose?</span>
          <textarea
            rows={3}
            value={explain}
            onChange={(event) => setExplain(event.target.value)}
            placeholder="Shown to them word for word. Say what goes and how it comes back."
          />
          <Issues list={issuesFor('explain')} />
        </label>

        <label className="field">
          <span>Ignore anything newer than</span>
          <input
            type="number"
            min="0"
            value={minAgeDays}
            onChange={(event) => setMinAgeDays(event.target.value)}
            placeholder="days — optional"
          />
          <Issues list={issuesFor('minAgeDays')} />
        </label>

        <div className="field">
          <span>Sample data</span>
          <em>
            Derived from the folders above. Without it nobody can prove the rule finds anything, so
            the schema will not accept the request — adjust the sizes if these are unrealistic.
          </em>
          {fixtureKeys.length === 0 && <Issues list={[{ message: 'name a folder first' }]} />}
          {fixtureKeys.map((key, index) => (
            <div className="sample" key={key}>
              <code>{key}</code>
              <input
                type="number"
                min="1"
                value={sizes[key] ?? starterSizes(index)}
                onChange={(event) => setSizes({ ...sizes, [key]: Number(event.target.value) })}
              />
              <span>bytes</span>
            </div>
          ))}
          <Issues list={issuesFor('fixture')} />
        </div>

        <label className="field">
          <span>Your email</span>
          <input
            value={requestedBy}
            onChange={(event) => setRequestedBy(event.target.value)}
            placeholder="so the pull request says whose idea it was"
          />
          <Issues list={issuesFor('requestedBy')} />
        </label>
      </div>

      <aside className="request-output">
        <div className={parsed.success ? 'verdict ok' : 'verdict bad'}>
          {parsed.success ? 'valid spec' : `${parsed.error.issues.length} thing(s) to fix`}
        </div>

        <pre className="spec-json">{json}</pre>

        <div className="field-row">
          <button
            className="button"
            disabled={!parsed.success}
            onClick={() => {
              void navigator.clipboard.writeText(json)
              setCopied(true)
              setTimeout(() => setCopied(false), 1600)
            }}
          >
            {copied ? 'copied' : 'copy JSON'}
          </button>
          <button className="button" data-variant="quiet" disabled={!parsed.success} onClick={download}>
            download {id}.spec.json
          </button>
        </div>

        <p className="request-next">
          Then an engineer runs one command, and CI takes it from there:
          <code>pnpm rule:new {id}.spec.json</code>
          Making the branch and the pull request from this page is not built yet — see the README.
        </p>
      </aside>
    </div>
  )
}

function Choice<T extends string>({
  name,
  value,
  current,
  onPick,
  label,
}: {
  name: string
  value: T
  current: T
  onPick: (value: T) => void
  label: string
}) {
  return (
    <label className="choice" data-on={current === value}>
      <input type="radio" name={name} checked={current === value} onChange={() => onPick(value)} />
      {label}
    </label>
  )
}

function Issues({ list }: { list: Array<{ message: string }> }) {
  if (list.length === 0) return null
  return (
    <ul className="issues">
      {list.map((issue) => (
        <li key={issue.message}>{issue.message}</li>
      ))}
    </ul>
  )
}
