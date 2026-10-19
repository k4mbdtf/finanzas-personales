// Compras en cuotas. Cada cuota es una transacción (gasto) en la tarjeta.
import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/errors'
import { emitChange } from '@/lib/events'
import { todayISO } from '@/lib/format'
import type { InstallmentPlan } from '@/types'

export type PlanWithStatus = InstallmentPlan & {
  /** Cuotas con fecha hasta hoy. */
  paidCount: number
  /** Suma de las cuotas futuras. */
  remaining: number
  next: { date: string; amount: number } | null
}

export async function listPlans(): Promise<PlanWithStatus[]> {
  const [plans, cuotas] = await Promise.all([
    supabase.from('installment_plans').select('*').order('first_date', { ascending: false }),
    supabase.from('transactions').select('installment_plan_id, date, amount')
      .not('installment_plan_id', 'is', null).order('date').limit(5000),
  ])
  const today = todayISO()
  const byPlan = new Map<string, { date: string; amount: number }[]>()
  for (const c of unwrap<{ installment_plan_id: string; date: string; amount: number }[]>(cuotas)) {
    const list = byPlan.get(c.installment_plan_id) ?? []
    list.push({ date: c.date, amount: Number(c.amount) })
    byPlan.set(c.installment_plan_id, list)
  }
  return unwrap<InstallmentPlan[]>(plans).map((p) => {
    const list = byPlan.get(p.id) ?? []
    const future = list.filter((c) => c.date > today)
    return {
      ...p,
      paidCount: list.length - future.length,
      remaining: future.reduce((s, c) => s + c.amount, 0),
      next: future[0] ?? null,
    }
  })
}

export async function createPlan(input: {
  description: string
  accountId: string
  categoryId: string | null
  total: number | null
  count: number
  firstDate: string
  installmentAmount: number | null
}): Promise<void> {
  unwrap(await supabase.rpc('create_installment_plan', {
    p_description: input.description,
    p_account_id: input.accountId,
    p_category_id: input.categoryId,
    p_total_amount: input.total,
    p_installments_count: input.count,
    p_first_date: input.firstDate,
    p_installment_amount: input.installmentAmount,
  }))
  emitChange('installments', 'transactions', 'accounts')
}

/** Solo descripción y categoría (la BD las propaga a todas las cuotas). */
export async function updatePlan(id: string, input: { description: string; category_id: string | null }): Promise<void> {
  unwrap(await supabase.from('installment_plans').update(input).eq('id', id))
  emitChange('installments', 'transactions')
}

/** Elimina la compra y TODAS sus cuotas (también las ya pasadas). */
export async function deletePlan(id: string): Promise<void> {
  unwrap(await supabase.from('installment_plans').delete().eq('id', id))
  emitChange('installments', 'transactions', 'accounts')
}
