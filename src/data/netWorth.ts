// Patrimonio neto a fin de cada mes (lo calcula la BD: net_worth_by_month).
// Con cuentas o deudas en UF/USD, la BD las valora con el valor de fin de cada mes guardado en
// exchange_rates: antes de consultar se traen los que falten (migración 0010).
import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/errors'
import { addDays, addMonths, monthRange } from '@/lib/dates'
import { todayISO } from '@/lib/format'
import { getRate } from '@/data/rates'
import type { ForeignCurrency } from '@/lib/currency'

export type NetWorthPoint = { month: string; assets: number; liabilities: number; net: number }

/** Guarda el valor de cada moneda a fin de cada mes del rango (hasta hoy), si no hay uno de esa última semana. */
async function ensureMonthEndRates(currencies: ForeignCurrency[], startYm: string, endYm: string) {
  if (currencies.length === 0) return
  const today = todayISO()
  const ends: string[] = []
  for (let ym = startYm; ym <= endYm; ym = addMonths(ym, 1)) {
    const end = monthRange(ym).to
    ends.push(end < today ? end : today)
    if (end >= today) break
  }
  const { data } = await supabase.from('exchange_rates').select('currency, date')
    .in('currency', currencies).gte('date', addDays(ends[0], -6)).lte('date', ends[ends.length - 1])
  const have = (data ?? []) as { currency: string; date: string }[]
  await Promise.all(currencies.flatMap((c) => ends
    .filter((end) => !have.some((r) => r.currency === c && r.date <= end && r.date >= addDays(end, -6)))
    .map((end) => getRate(c, end).catch(() => null))))
}

/** Los `count` meses que terminan en `endYm` (incluido), en orden cronológico. */
export async function netWorthByMonth(endYm: string, count: number, currencies: ForeignCurrency[] = []): Promise<NetWorthPoint[]> {
  const startYm = addMonths(endYm, -(count - 1))
  await ensureMonthEndRates(currencies, startYm, endYm)
  const rows = unwrap<{ month: string; assets: number; liabilities: number }[]>(
    await supabase.rpc('net_worth_by_month', { p_from: monthRange(startYm).from, p_to: monthRange(endYm).from }),
  )
  return rows.map((r) => {
    const assets = Number(r.assets)
    const liabilities = Number(r.liabilities)
    return { month: r.month.slice(0, 7), assets, liabilities, net: assets - liabilities }
  })
}
