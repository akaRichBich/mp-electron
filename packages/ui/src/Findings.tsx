import type { CSSProperties, ReactNode } from 'react'
import type { Finding } from '@mp/core'
import { applyScale, scaleFor, shortPath } from '@mp/core'

export function Findings({
  findings,
  renderAction,
}: {
  findings: Finding[]
  /** The desktop shell puts a remove button here. The web shell passes nothing. */
  renderAction?: (finding: Finding) => ReactNode
}) {
  const largest = Math.max(...findings.map((f) => f.bytes), 1)

  return (
    <div className="findings">
      {findings.map((finding, index) => {
        const scale = scaleFor(finding.bytes)
        const action = renderAction?.(finding)
        return (
          <article
            className="finding"
            data-level={finding.safety}
            style={{ '--i': index } as CSSProperties}
            key={`${finding.ruleId}:${finding.path}`}
          >
            <div className="finding-name">
              <b>{finding.title}</b>
              <span className="tag" data-level={finding.safety}>
                {finding.safety}
              </span>
            </div>

            <div className="finding-where">
              <code title={finding.path}>{shortPath(finding.path)}</code>
              <div className="bar">
                <i style={{ width: `${(finding.bytes / largest) * 100}%` }} />
              </div>
            </div>

            <div className="finding-size">
              {applyScale(finding.bytes, scale)}
              <span>{scale.unit}</span>
              {action && <div className="finding-action">{action}</div>}
            </div>

            <p className="explain">
              {finding.explain} <span className="ghost">· {finding.entries} files</span>
            </p>
          </article>
        )
      })}
    </div>
  )
}
