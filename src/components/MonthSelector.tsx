import { useMonth } from '@/context/Month'
import { addMonths, currentMonth, monthLabel } from '@/lib/dates'

export function MonthSelector() {
  const { month, setMonth } = useMonth()
  const isCurrent = month === currentMonth()
  const btn = 'grid size-10 place-items-center rounded-full text-xl hover:bg-slate-100 dark:hover:bg-slate-800'
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Mes">
      <button type="button" className={btn} onClick={() => setMonth(addMonths(month, -1))}
        aria-label={`Mes anterior: ${monthLabel(addMonths(month, -1))}`}>‹</button>
      <span className="min-w-36 text-center font-semibold" aria-live="polite">{monthLabel(month)}</span>
      <button type="button" className={btn} onClick={() => setMonth(addMonths(month, 1))}
        aria-label={`Mes siguiente: ${monthLabel(addMonths(month, 1))}`}>›</button>
      {!isCurrent && (
        <button type="button" onClick={() => setMonth(currentMonth())}
          className="ml-1 rounded-full border border-slate-300 px-3 py-1 text-xs font-medium hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800">
          Hoy
        </button>
      )}
    </div>
  )
}
