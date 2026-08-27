import { useEffect, useState } from 'react'
import { applyScale, scaleFor } from '../format'

function useCountUp(target: number, duration = 800): number {
  const [value, setValue] = useState(target)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }
    let frame = 0
    const start = performance.now()
    const tick = (time: number) => {
      const progress = Math.min(1, (time - start) / duration)
      setValue(target * (1 - Math.pow(1 - progress, 4)))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])

  return value
}

export function Readout({
  bytes,
  locations,
  scanned,
}: {
  bytes: number
  locations: number
  scanned: string
}) {
  const animated = useCountUp(bytes)
  const scale = scaleFor(bytes)

  return (
    <div className="readout">
      <div className="figure">
        {applyScale(Math.min(animated, bytes), scale)}
        <sub>{scale.unit}</sub>
      </div>
      <div className="readout-meta">
        reclaimable across <span>{locations}</span> location{locations === 1 ? '' : 's'}
        <br />
        scanned <span>{scanned}</span>
      </div>
    </div>
  )
}
