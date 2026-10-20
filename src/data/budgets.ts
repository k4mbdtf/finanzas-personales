// Presupuestos mensuales por categoría de gasto y gasto real por categoría.
import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/errors'
import { emitChange } from '@/lib/events'
import { monthRange } from '@/lib/dates'
import type { Budget } from '@/types'

/** "2026-10" -> "2026-10-01" (así se guarda `month` en la BD). */
const monthDate = (ym: string) => `${ym}-01`

export async function listBudgets(ym: string): Promise<Budget[]> {
  return unwrap<Budget[]>(
    await supabase.from('budgets').select('id, category_id, month, amount').eq('month', monthDate(ym)),
  )
}

/** Crea o actualiza el presupuesto de una categoría para el mes. */
export async function setBudget(categoryId: string, ym: string, amount: number): Promise<void> {
  unwrap(
    await supabase
      .from('budgets')
      .upsert({ category_id: categoryId, month: monthDate(ym), amount }, { onConflict: 'user_id,category_id,month' }),
  )
  emitChange('budgets')
}

export async function deleteBudget(id: string): Promise<void> {
  unwrap(await supabase.from('budgets').delete().eq('id', id))
  emitChange('budgets')
}

/** Copia los presupuestos de `fromYm` a `toYm` sin pisar los que ya existan.
 *  Devuelve cuántos se copiaron. */
export async function copyBudgets(fromYm: string, toYm: string): Promise<number> {
  const source = await listBudgets(fromYm)
  if (source.length === 0) return 0
  const rows = source.map((b) => ({ category_id: b.category_id, month: monthDate(toYm), amount: b.amount }))
  const inserted = unwrap<unknown[]>(
    await supabase
      .from('budgets')
      .upsert(rows, { onConflict: 'user_id,category_id,month', ignoreDuplicates: true })
      .select('id'),
  )
  emitChange('budgets')
  return inserted.length
}

/** Gasto del mes por categoría (sin transferencias). Clave '' = sin categoría. */
export async function spendingByCategory(ym: string): Promise<Map<string, number>> {
  const { from, to } = monthRange(ym)
  return spendingBetween(from, to)
}

/** Gasto por categoría entre dos fechas (incluidas). Clave '' = sin categoría. */
export async function spendingBetween(from: string, to: string): Promise<Map<string, number>> {
  const rows = unwrap<{ category_id: string | null; total: number }[]>(
    await supabase.rpc('spending_by_category', { p_from: from, p_to: to }),
  )
  return new Map(rows.map((r) => [r.category_id ?? '', Number(r.total)]))
}

/** Uso del presupuesto de una categoría en un mes, o null si no tiene. */
export async function budgetUsage(categoryId: string, ym: string): Promise<{ amount: number; spent: number } | null> {
  const [budgets, spending] = await Promise.all([listBudgets(ym), spendingByCategory(ym)])
  const b = budgets.find((x) => x.category_id === categoryId)
  return b ? { amount: b.amount, spent: spending.get(categoryId) ?? 0 } : null
}
