import { useEffect, useRef, type ReactNode } from 'react'

export interface ConfirmLine {
  label: string
  value: string
}

/**
 * A real modal, not an inline panel: a removal is the one irreversible thing
 * this app does, and it deserves to take over the screen for a moment.
 */
export function ConfirmDialog({
  open,
  title,
  lines,
  confirmLabel,
  onConfirm,
  onCancel,
  busy = false,
  footnote,
}: {
  open: boolean
  title: string
  lines: ConfirmLine[]
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
  footnote?: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // Escape closes it, and cancelling is the safe outcome.
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const handle = (event: Event) => {
      event.preventDefault()
      onCancel()
    }
    dialog.addEventListener('cancel', handle)
    return () => dialog.removeEventListener('cancel', handle)
  }, [onCancel])

  return (
    <dialog className="confirm" ref={ref} aria-labelledby="confirm-title">
      <p className="confirm-eyebrow">about to delete</p>
      <h2 id="confirm-title">{title}</h2>

      <dl className="confirm-lines">
        {lines.map((line) => (
          <div key={line.label}>
            <dt>{line.label}</dt>
            <dd>{line.value}</dd>
          </div>
        ))}
      </dl>

      {footnote && <p className="confirm-footnote">{footnote}</p>}

      <div className="confirm-actions">
        <button className="button" data-variant="danger" onClick={onConfirm} disabled={busy}>
          {busy ? 'removing…' : confirmLabel}
        </button>
        <button className="button" data-variant="quiet" onClick={onCancel} disabled={busy} autoFocus>
          keep it
        </button>
      </div>
    </dialog>
  )
}
