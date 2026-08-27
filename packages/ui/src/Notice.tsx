import { useEffect, useRef, type ReactNode } from 'react'

/** Why something did not happen, said where the user asked for it. */
export function Notice({
  title,
  detail,
  onDismiss,
  tone = 'warn',
}: {
  title: string
  detail: ReactNode
  onDismiss?: () => void
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
