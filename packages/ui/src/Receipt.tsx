import { formatBytes } from '@mp/core'

export interface Freed {
  items: number
  files: number
  bytes: number
}

/** What actually went, in the units a person cares about. */
export function Receipt({
  what,
  where,
  files,
  bytes,
  session,
  onDismiss,
}: {
  what: string
  where: string
  files: number
  bytes: number
  /** Running total for this session, shown once more than one thing has gone. */
  session?: Freed
  onDismiss?: () => void
}) {
  return (
    <div className="receipt-card">
      <p className="section-label">removed</p>

      <div className="receipt-figures">
        <span>
          <b>{files}</b> file{files === 1 ? '' : 's'}
        </span>
        <span className="receipt-sep" aria-hidden="true">
          ·
        </span>
        <span>
          <b>{formatBytes(bytes)}</b> freed
        </span>
      </div>

      <p className="receipt-where">
        {what} — <code>{where}</code>
      </p>

      {session && session.items > 1 && (
        <p className="receipt-session">
          this session: {session.items} items · {session.files} files ·{' '}
          {formatBytes(session.bytes)}
        </p>
      )}

      {onDismiss && (
        <p>
          <button className="button" data-variant="quiet" onClick={onDismiss}>
            dismiss
          </button>
        </p>
      )}
    </div>
  )
}
