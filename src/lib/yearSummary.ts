// Resumen de un año: totales, comparación con el año anterior, meses destacados y
// gasto por categoría. Recibe los totales mensuales y el gasto por categoría ya
// calculados por la BD (monthly_totals y spending_by_category).
// Sin imports a propósito: se prueba con `node --test` (yearSummary.test.ts).

export type MonthTotals = { month: string; income: number; expense: number }

export type YearTotals = {
  income: number
  expense: number
  saving: number
  /** Ahorro ÷ ingresos (null sin ingresos). */
  savingRate: number | null
  /** Meses con algún movimiento (para promediar sin contar meses vacíos o futuros). */
  activeMonths: number
  avgExpense: number
}

export type CategoryRow = {
  /** '' = sin categoría. */
  categoryId: string
  amount: number
  /** Parte del gasto del año (0 a 1). */
  share: number
  previous: number
  /** Diferencia con el año anterior (positivo = gastaste más). */
  diff: number
}

export function yearTotals(months: MonthTotals[]): YearTotals {
  const income = months.reduce((s, m) => s + m.income, 0)
  const expense = months.reduce((s, m) => s + m.expense, 0)
  const activeMonths = months.filter((m) => m.income > 0 || m.expense > 0).length
  return {
    income, expense, saving: income - expense,
    savingRate: income > 0 ? (income - expense) / income : null,
    activeMonths,
    avgExpense: activeMonths ? Math.round(expense / activeMonths) : 0,
  }
}

/** Mes con más gasto y mes con más ahorro (solo meses con movimientos). */
export function highlights(months: MonthTotals[]): { maxExpense: MonthTotals | null; bestSaving: MonthTotals | null } {
  const active = months.filter((m) => m.income > 0 || m.expense > 0)
  if (active.length === 0) return { maxExpense: null, bestSaving: null }
  const maxExpense = active.reduce((a, b) => (b.expense > a.expense ? b : a))
  const bestSaving = active.reduce((a, b) => (b.income - b.expense > a.income - a.expense ? b : a))
  return { maxExpense, bestSaving }
}

/**
 * Gasto por categoría del año con el del año anterior, de mayor a menor. Incluye las
 * categorías que solo tuvieron gasto el año anterior (con 0 este año) al final.
 */
export function categoryComparison(current: Map<string, number>, previous: Map<string, number>): CategoryRow[] {
  const total = [...current.values()].reduce((s, v) => s + v, 0)
  const ids = new Set([...current.keys(), ...previous.keys()])
  return [...ids]
    .map((categoryId) => {
      const amount = current.get(categoryId) ?? 0
      const prev = previous.get(categoryId) ?? 0
      return { categoryId, amount, share: total ? amount / total : 0, previous: prev, diff: amount - prev }
    })
    .filter((r) => r.amount > 0 || r.previous > 0)
    .sort((a, b) => b.amount - a.amount || b.previous - a.previous)
}
