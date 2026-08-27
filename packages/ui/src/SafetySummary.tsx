import { deletableFindings, type Finding, type SafetyLevel } from '@mp/core'

const LEVELS: Array<{ level: SafetyLevel; label: string; note: string }> = [
  { level: 'safe', label: 'safe to remove', note: 'goes without asking' },
  { level: 'review', label: 'worth a look', note: 'listed, never removed for you' },
  { level: 'dangerous', label: 'report only', note: 'never offered for removal' },
]

/**
 * Answers "which of these can go?" before the reader has to scan the list for
 * badges. Counts come from the report, never from a hand-written number.
 */
export function SafetySummary({ findings }: { findings: Finding[] }) {
  const deletable = deletableFindings(findings).length

  return (
    <div className="safety-summary">
      {LEVELS.map(({ level, label, note }) => {
        const count = findings.filter((finding) => finding.safety === level).length
        if (count === 0) return null
        return (
          <span className="chip" data-level={level} key={level} title={note}>
            <i />
            {count} {label}
          </span>
        )
      })}
      <span className="chip-note">
        {deletable === 0
          ? 'nothing in this report is removable by this build'
          : `${deletable} removable in this build`}
      </span>
    </div>
  )
}
