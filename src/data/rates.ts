// Valor en pesos de la UF y del dólar en una fecha (migración 0009).
//  1) Lo ya guardado en exchange_rates (lo trajo antes la app o lo ingresó el usuario).
//  2) Si no está, mindicador.cl (UF del día; dólar observado del último día hábil) y se guarda.
//  3) Si tampoco se puede, null: el formulario pide el valor a mano (saveRate).
import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/errors'
import { addDays } from '@/lib/dates'
import type { ForeignCurrency, Rates } from '@/lib/currency'

const API = 'https://mindicador.cl/api'
const SERIES: Record<ForeignCurrency, string> = { UF: 'uf', USD: 'dolar' }
const cache = new Map<string, number>()

/** "2026-10-20" -> "20-10-2026" (formato de mindicador). */
const ddmmyyyy = (iso: string) => iso.split('-').reverse().join('-')

async function fromApi(currency: ForeignCurrency, date: string): Promise<number | null> {
  // El dólar no se publica fines de semana ni feriados: se busca hacia atrás hasta 7 días.
  const tries = currency === 'USD' ? 7 : 1
  for (let i = 0; i < tries; i++) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 6000)
    try {
      const res = await fetch(`${API}/${SERIES[currency]}/${ddmmyyyy(addDays(date, -i))}`, { signal: ctrl.signal })
      if (!res.ok) return null
      const body = await res.json() as { serie?: { valor: number }[] }
      const value = body.serie?.[0]?.valor
      if (value && value > 0) return value
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
  }
  return null
}

/** Valor de 1 UF o 1 USD en pesos para esa fecha, o null si no se pudo obtener. */
export async function getRate(currency: ForeignCurrency, date: string): Promise<number | null> {
  const key = `${currency}|${date}`
  const hit = cache.get(key)
  if (hit) return hit
  const saved = await supabase.from('exchange_rates').select('clp').eq('currency', currency).eq('date', date).maybeSingle()
  let value = saved.data ? Number(saved.data.clp) : null
  if (!value) {
    value = await fromApi(currency, date)
    // Se guarda para la próxima vez (si falla, no importa: se vuelve a consultar).
    if (value) await supabase.from('exchange_rates').upsert({ currency, date, clp: value })
  }
  if (value) cache.set(key, value)
  return value
}

/** Guarda un valor ingresado a mano (reemplaza el del día si existía). */
export async function saveRate(currency: ForeignCurrency, date: string, clp: number): Promise<void> {
  unwrap(await supabase.from('exchange_rates').upsert({ currency, date, clp }))
  cache.set(`${currency}|${date}`, clp)
}

/** Valores de hoy de las monedas pedidas (las que falten quedan fuera). */
export async function todayRates(currencies: ForeignCurrency[], today: string): Promise<Rates> {
  const out: Rates = {}
  await Promise.all(currencies.map(async (c) => {
    const v = await getRate(c, today)
    if (v) out[c] = v
  }))
  return out
}
