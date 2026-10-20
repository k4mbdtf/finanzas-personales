// Cálculos de inversiones (sin consultas): ganancia, si conviene actualizar el
// valor y la serie del gráfico. Usa el mismo criterio que la vista
// investment_status de la BD: una valorización fija el valor y los aportes o
// rescates posteriores (por fecha y, el mismo día, por hora de registro) lo ajustan.
// Sin imports a propósito: se prueba con `node --test` (investments.test.ts).

export const INVESTMENT_KINDS = {
  fund: 'Fondo mutuo',
  stocks: 'Acciones o ETF',
  deposit: 'Depósito a plazo',
  crypto: 'Cripto',
  retirement: 'APV / previsional',
  other: 'Otra',
} as const

/** Sugerencias para "¿Dónde está?" (se puede escribir cualquier otra). */
export const PLATFORM_SUGGESTIONS = [
  'Fintual', 'Racional', 'Buda.com', 'BancoEstado', 'Banco de Chile', 'Santander', 'Bci', 'Itaú',
  'Scotiabank', 'Banco Falabella', 'Mercado Pago', 'Tenpo', 'MACH', 'AFP',
]

type Totals = { contributed: number; withdrawn: number; current_value: number }

/** Ganancia = valor actual + lo rescatado − lo aportado; el % es sobre lo aportado. */
export function investmentGain(s: Totals): { gain: number; pct: number | null } {
  const gain = s.current_value + s.withdrawn - s.contributed
  return { gain, pct: s.contributed > 0 ? gain / s.contributed : null }
}

/** Días entre dos fechas YYYY-MM-DD. */
export function daysBetween(from: string, to: string): number {
  const t = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((t(to) - t(from)) / 86_400_000)
}

/** Conviene actualizar el valor: hay algo invertido y nunca se valorizó o pasó más de `days` días. */
export function needsValuation(s: Totals & { valued_at: string | null }, today: string, days = 31): boolean {
  if (s.current_value <= 0 && s.contributed <= s.withdrawn) return false
  return !s.valued_at || daysBetween(s.valued_at, today) > days
}

/** delta > 0 = aporte; < 0 = rescate. created_at decide el orden dentro del mismo día. */
export type Flow = { date: string; created_at: string; delta: number }
export type Valuation = { date: string; created_at: string; value: number }
export type SeriesPoint = { date: string; value: number; invested: number }

/**
 * Serie para el gráfico: un punto por fecha con el valor estimado y lo aportado
 * neto (aportes − rescates, nunca bajo 0) al cierre de ese día. Si `today` es
 * posterior al último punto, se agrega hoy con el valor vigente.
 */
export function valueSeries(
  initial: number, startDate: string, flows: Flow[], valuations: Valuation[], today?: string,
): SeriesPoint[] {
  type Ev = { date: string; at: string; flow?: number; value?: number }
  const events: Ev[] = [
    ...flows.map((f) => ({ date: f.date, at: f.created_at, flow: f.delta })),
    ...valuations.map((v) => ({ date: v.date, at: v.created_at, value: v.value })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at))

  let value = initial
  let invested = initial
  const points: SeriesPoint[] = []
  const push = (date: string) => {
    const last = points[points.length - 1]
    const p = { date, value, invested: Math.max(0, invested) }
    if (last?.date === date) Object.assign(last, p)
    else points.push(p)
  }

  const first = events[0]?.date
  if (initial > 0) push(first && first < startDate ? first : startDate)
  for (const e of events) {
    if (e.flow !== undefined) {
      value = Math.max(0, value + e.flow)
      invested += e.flow
    } else if (e.value !== undefined) {
      value = e.value
    }
    push(e.date)
  }
  const last = points[points.length - 1]
  if (today && last && today > last.date) push(today)
  return points
}
