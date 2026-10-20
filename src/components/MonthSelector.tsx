import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMonth } from '@/context/Month'
import { addMonths, currentMonth, monthLabel } from '@/lib/dates'

export function MonthSelector() {
  const { month, setMonth } = useMonth()
  const isCurrent = month === currentMonth()
  const btn = 'pressable grid size-10 place-items-center rounded-full text-soft hover:bg-subtle hover:text-ink'
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Mes">
      <button type="button" className={btn} onClick={() => setMonth(addMonths(month, -1))}
        aria-label={`Mes anterior: ${monthLabel(addMonths(month, -1))}`}>
        <ChevronLeft size={20} strokeWidth={2} aria-hidden />
      </button>
      {/* key: el nombre del mes aparece suave al cambiar */}
      <span key={month} className="animate-fade min-w-36 text-center text-[0.9375rem] font-semibold tracking-tight" aria-live="polite">
        {monthLabel(month)}
      </span>
      <button type="button" className={btn} onClick={() => setMonth(addMonths(month, 1))}
        aria-label={`Mes siguiente: ${monthLabel(addMonths(month, 1))}`}>
        <ChevronRight size={20} strokeWidth={2} aria-hidden />
      </button>
      {!isCurrent && (
        <button type="button" onClick={() => setMonth(currentMonth())}
          className="pressable animate-fade ml-1 rounded-sm border border-line-strong/45 px-2.5 py-1 text-xs font-semibold hover:bg-subtle">
          Hoy
        </button>
      )}
    </div>
  )
}
