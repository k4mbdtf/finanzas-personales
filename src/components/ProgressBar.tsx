// Barra de progreso accesible (el valor también se muestra en texto al lado).
// Crece desde 0 al aparecer con una transición suave (solo transform).
import { useEffect, useState } from 'react'

export function ProgressBar({
  pct, label, barClass = 'bg-ink', thick,
}: { pct: number; label: string; barClass?: string; thick?: boolean }) {
  const v = Math.max(0, Math.min(100, Math.round(pct)))
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const f = requestAnimationFrame(() => setShown(v))
    return () => cancelAnimationFrame(f)
  }, [v])
  return (
    <div className={`overflow-hidden rounded-xs bg-subtle ${thick ? 'h-2' : 'h-1.5'}`}
      role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} aria-label={label}>
      <div className={`h-full w-full origin-left rounded-xs transition-transform duration-700 ease-soft ${barClass}`}
        style={{ transform: `scaleX(${shown / 100})` }} />
    </div>
  )
}
