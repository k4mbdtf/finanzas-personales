// Barra de progreso de un presupuesto (reutilizable en el dashboard).
// Ámbar al 80%, rojo al 100%; siempre con ícono y texto para no depender del color.
import { budgetStatus, LEVEL_UI } from '@/lib/budget'
import { formatCLP } from '@/lib/format'
import { CategoryIcon } from '@/components/icons'
import { ProgressBar } from '@/components/ProgressBar'
import type { Category } from '@/types'

export function BudgetProgress({
  category, spent, amount, onClick,
}: { category: Category; spent: number; amount: number; onClick?: () => void }) {
  const { pct, level } = budgetStatus(spent, amount)
  const ui = LEVEL_UI[level]
  const Icon = ui.icon
  const remaining = amount - spent

  return (
    <button onClick={onClick} disabled={!onClick}
      className="card flex w-full flex-col gap-3 p-4 text-left transition-[border-color,transform] duration-200 enabled:hover:border-line-strong/40 enabled:active:scale-[0.99]">
      <div className="flex items-center gap-3">
        <CategoryIcon name={category.icon} color={category.color} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{category.name}</p>
          <p className="text-[0.8125rem] text-muted tabular-nums">
            {formatCLP(spent)} de {formatCLP(amount)}
          </p>
        </div>
        <span className={`text-[0.9375rem] font-bold tabular-nums ${ui.text}`}>{pct}%</span>
      </div>
      <ProgressBar pct={pct} label={`${category.name}: ${pct}% usado`} barClass={ui.bar} />
      <p className={`flex items-center gap-1.5 text-xs font-medium ${ui.text}`}>
        {level !== 'ok' && <Icon size={14} strokeWidth={2.25} aria-hidden />}
        {level === 'over'
          ? `Excedido por ${formatCLP(-remaining)}`
          : `Quedan ${formatCLP(remaining)}${level === 'warn' ? ' · Cerca del límite' : ''}`}
      </p>
    </button>
  )
}
