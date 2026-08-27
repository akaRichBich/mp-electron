import type { ReactNode } from 'react'
import { CAPABILITY_LABELS, type PortCapabilities } from '@mp/core'

export interface RailColumn {
  label: string
  capabilities: PortCapabilities
}

/**
 * The capability matrix is rendered from `SHELL_CAPABILITIES`, the same table
 * the ports themselves import. It cannot drift from what the port does.
 */
export function Rail({
  badge,
  portId,
  portLabel,
  columns,
  active,
  children,
}: {
  badge: string
  portId: string
  portLabel: string
  columns: RailColumn[]
  /** Index of the column describing the shell you are looking at. */
  active: number
  children?: ReactNode
}) {
  return (
    <aside className="rail">
      <div className="mark">
        <svg width="30" height="30" viewBox="0 0 128 128" aria-hidden="true">
          <circle cx="64" cy="64" r="38" fill="none" stroke="#232b36" strokeWidth="10" />
          <path
            d="M64 26a38 38 0 0 1 32.9 57"
            fill="none"
            stroke="#ffb020"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <circle cx="64" cy="64" r="7" fill="#ffb020" />
        </svg>
        <div>
          <b>Reclaim</b>
          <span>{badge}</span>
        </div>
      </div>

      <section>
        <h2>Port</h2>
        <div className="port-id">
          {portId} <em>{portLabel}</em>
        </div>
      </section>

      <section>
        <h2>Capabilities</h2>
        <div className="matrix" style={{ gridTemplateColumns: `1fr repeat(${columns.length}, 1.6rem)` }}>
          <span />
          {columns.map((column, index) => (
            <span className="matrix-head" data-active={index === active} key={column.label}>
              {column.label}
            </span>
          ))}

          {CAPABILITY_LABELS.map((capability) => (
            <div className="matrix-row" key={capability.key}>
              <span>{capability.label}</span>
              {columns.map((column, index) => (
                <span
                  className="dot"
                  key={column.label}
                  data-on={column.capabilities[capability.key]}
                  data-ghost={index !== active}
                />
              ))}
            </div>
          ))}

          <div className="matrix-row">
            <span>same rule engine</span>
            {columns.map((column, index) => (
              <span className="dot" key={column.label} data-on={true} data-ghost={index !== active} />
            ))}
          </div>
        </div>
      </section>

      <p className="rail-note">{children}</p>
    </aside>
  )
}
