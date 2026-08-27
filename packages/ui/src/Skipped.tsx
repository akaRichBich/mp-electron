import type { SkippedRule } from '@mp/core'

export function Skipped({ skipped }: { skipped: SkippedRule[] }) {
  if (skipped.length === 0) return null

  return (
    <section className="skipped">
      <h2 className="section-label">not evaluated here</h2>
      <ul>
        {skipped.map((entry) => (
          <li key={entry.ruleId}>
            <b>{entry.ruleId}</b>
            <span>{entry.reason}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
