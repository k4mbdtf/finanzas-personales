// Reglas visuales de presupuestos: normal < 80% <= cerca del límite < 100% <= excedido.
import { CircleCheck, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react'

export const WARN_AT = 80
export const OVER_AT = 100

export type BudgetLevel = 'ok' | 'warn' | 'over'

export function budgetStatus(spent: number, amount: number): { pct: number; level: BudgetLevel } {
  const pct = amount > 0 ? Math.round((spent / amount) * 100) : 0
  return { pct, level: pct >= OVER_AT ? 'over' : pct >= WARN_AT ? 'warn' : 'ok' }
}

/** Estilos y textos por nivel (el ícono y el texto evitan depender solo del color). */
export const LEVEL_UI: Record<BudgetLevel, { bar: string; text: string; label: string; icon: LucideIcon }> = {
  ok: { bar: 'bg-ink', text: 'text-soft', label: 'Dentro del presupuesto', icon: CircleCheck },
  warn: { bar: 'bg-warn-bar', text: 'text-warn', label: 'Cerca del límite', icon: TriangleAlert },
  over: { bar: 'bg-neg-bar', text: 'text-neg', label: 'Presupuesto excedido', icon: OctagonAlert },
}
