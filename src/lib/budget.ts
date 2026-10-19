// Reglas visuales de presupuestos: normal < 80% <= cerca del límite < 100% <= excedido.
export const WARN_AT = 80
export const OVER_AT = 100

export type BudgetLevel = 'ok' | 'warn' | 'over'

export function budgetStatus(spent: number, amount: number): { pct: number; level: BudgetLevel } {
  const pct = amount > 0 ? Math.round((spent / amount) * 100) : 0
  return { pct, level: pct >= OVER_AT ? 'over' : pct >= WARN_AT ? 'warn' : 'ok' }
}

/** Estilos y textos por nivel (el texto evita depender solo del color). */
export const LEVEL_UI: Record<BudgetLevel, { bar: string; text: string; label: string; icon: string }> = {
  ok: { bar: 'bg-teal-600', text: 'text-slate-600 dark:text-slate-300', label: 'Dentro del presupuesto', icon: '✓' },
  warn: { bar: 'bg-amber-500', text: 'text-amber-800 dark:text-amber-300', label: 'Cerca del límite', icon: '⚠️' },
  over: { bar: 'bg-red-600', text: 'text-red-700 dark:text-red-400', label: 'Presupuesto excedido', icon: '⛔' },
}
