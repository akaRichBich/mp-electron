import { useEffect, useRef, type ReactNode } from 'react'

/** Why something did not happen, said where the user asked for it. */
export function Notice({
  title,
  detail,
  onDismiss,
  actions,
  tone = 'warn',
}: {
  title: string
  detail: ReactNode
  onDismiss?: () => void
  /** Buttons for a decision this notice is asking the reader to make. */
  actions?: ReactNode
  tone?: 'warn' | 'error' | 'plain'
}) {
  const ref = useRef<HTMLDivElement>(null)

  // The click that raised this can be far down a long list.
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ref.current?.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' })
  }, [title, detail])

  return (
    <div className="panel" data-tone={tone} ref={ref}>
      <h3>{title}</h3>
      <p>{detail}</p>
      {(actions || onDismiss) && (
        <p className="notice-actions">
          {actions}
          {onDismiss && (
            <button className="button" data-variant="quiet" onClick={onDismiss}>
              {actions ? 'cancel' : 'dismiss'}
            </button>
          )}
        </p>
      )}
    </div>
  )
}
