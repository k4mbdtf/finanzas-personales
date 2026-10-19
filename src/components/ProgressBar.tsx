// Barra de progreso accesible (el texto del valor va al lado, no solo el color).
export function ProgressBar({
  pct, label, barClass = 'bg-teal-600',
}: { pct: number; label: string; barClass?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(pct)))
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
      role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} aria-label={label}>
      <div className={`h-full rounded-full ${barClass}`} style={{ width: `${v}%` }} />
    </div>
  )
}
