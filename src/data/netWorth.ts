// Patrimonio neto a fin de cada mes (lo calcula la BD: net_worth_by_month).
import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/errors'
import { addMonths, monthRange } from '@/lib/dates'

export type NetWorthPoint = { month: string; assets: number; liabilities: number; net: number }

/** Los `count` meses que terminan en `endYm` (incluido), en orden cronológico. */
export async function netWorthByMonth(endYm: string, count: number): Promise<NetWorthPoint[]> {
  const startYm = addMonths(endYm, -(count - 1))
  const rows = unwrap<{ month: string; assets: number; liabilities: number }[]>(
    await supabase.rpc('net_worth_by_month', { p_from: monthRange(startYm).from, p_to: monthRange(endYm).from }),
  )
  return rows.map((r) => {
    const assets = Number(r.assets)
    const liabilities = Number(r.liabilities)
    return { month: r.month.slice(0, 7), assets, liabilities, net: assets - liabilities }
  })
}
