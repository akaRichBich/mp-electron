import { FSAA_CAPABILITIES } from '@mp/port-fsaa'

const CAPABILITIES = [
  { key: 'canDelete', label: 'delete in place' },
  { key: 'canScanWithoutPicker', label: 'no folder picker' },
  { key: 'canRunInBackground', label: 'background scans' },
] as const

export function Rail() {
  return (
    <aside className="rail">
      <div className="mark">
        <svg width="30" height="30" viewBox="0 0 128 128" aria-hidden="true">
          <circle cx="64" cy="64" r="38" fill="none" stroke="#232b36" strokeWidth="10" />
          <path d="M64 26a38 38 0 0 1 32.9 57" fill="none" stroke="#ffb020" strokeWidth="10" strokeLinecap="round" />
          <circle cx="64" cy="64" r="7" fill="#ffb020" />
        </svg>
        <div>
          <b>Reclaim</b>
          <span>web preview</span>
        </div>
      </div>

      <section>
        <h2>Port</h2>
        <div className="port-id">
          fsaa <em>File System Access API</em>
        </div>
      </section>

      <section>
        <h2>Capabilities</h2>
        <div className="matrix">
          <span />
          <span className="matrix-head">web</span>
          <span className="matrix-head">app</span>

          {CAPABILITIES.map((capability) => (
            <div className="matrix-row" key={capability.key}>
              <span>{capability.label}</span>
              <span className="dot" data-on={FSAA_CAPABILITIES[capability.key]} />
              <span className="dot" data-on={true} data-ghost={true} />
            </div>
          ))}

          <div className="matrix-row">
            <span>same rule engine</span>
            <span className="dot" data-on={true} />
            <span className="dot" data-on={true} data-ghost={true} />
          </div>
        </div>
      </section>

      <p className="rail-note">
        The UI reads <b>port.capabilities</b>, never <b>isElectron</b>. Both shells import the
        same <b>@mp/core</b>; only the port under it changes.
      </p>
    </aside>
  )
}
