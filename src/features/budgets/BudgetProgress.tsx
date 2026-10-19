// Barra de progreso de un presupuesto (reutilizable en el dashboard).
// Ámbar al 80%, rojo al 100%; siempre con texto para no depender del color.
import { budgetStatus, LEVEL_UI } from '@/lib/budget'
import { formatCLP } from '@/lib/format'
import { iconFor } from '@/lib/icons'
import type { Category } from '@/types'

export function BudgetProgress({
  category, spent, amount, onClick,
}: { category: Category; spent: number; amount: number; onClick?: () => void }) {
  const { pct, level } = budgetStatus(spent, amount)
  const ui = LEVEL_UI[level]
  const remaining = amount - spent

  return (
    <button onClick={onClick} disabled={!onClick}
      className="flex w-full flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-left enabled:hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full text-lg" style={{ backgroundColor: `${category.color}33` }} aria-hidden>
          {iconFor(category.icon)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{category.name}</p>
          <p className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
            {formatCLP(spent)} de {formatCLP(amount)}
          </p>
        </div>
        <span className={`text-sm font-bold tabular-nums ${ui.text}`}>{pct}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
        role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(pct, 100)}
        aria-label={`${category.name}: ${pct}% usado`}>
        <div className={`h-full rounded-full ${ui.bar}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <p className={`text-xs font-medium ${ui.text}`}>
        {level !== 'ok' && <span aria-hidden>{ui.icon} </span>}
        {level === 'over'
          ? `Excedido por ${formatCLP(-remaining)}`
          : `Quedan ${formatCLP(remaining)}${level === 'warn' ? ' · Cerca del límite' : ''}`}
      </p>
    </button>
  )
}
