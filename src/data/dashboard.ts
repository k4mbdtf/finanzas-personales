// Datos agregados para el dashboard.
import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/errors'
import { addMonths, monthRange } from '@/lib/dates'

export type MonthTotal = { month: string; income: number; expense: number }

/** Ingresos y gastos de los `count` meses que terminan en `endYm` (incluido),
 *  en orden cronológico y con 0 en los meses sin movimientos. */
export async function monthlyTotals(endYm: string, count = 12): Promise<MonthTotal[]> {
  const startYm = addMonths(endYm, -(count - 1))
  const rows = unwrap<{ month: string; income: number; expense: number }[]>(
    await supabase.rpc('monthly_totals', { p_from: monthRange(startYm).from, p_to: monthRange(endYm).to }),
  )
  const byMonth = new Map(rows.map((r) => [r.month.slice(0, 7), r]))
  return Array.from({ length: count }, (_, i) => {
    const ym = addMonths(startYm, i)
    const r = byMonth.get(ym)
    return { month: ym, income: Number(r?.income ?? 0), expense: Number(r?.expense ?? 0) }
  })
}
