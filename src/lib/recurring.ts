// Fechas de transacciones recurrentes. Replica public.recurring_occurrence()
// (migración 0005) para mostrar "próximas fechas" sin consultar la BD.
// Siempre se calcula desde la fecha de inicio: 31-ene mensual => 28-feb, 31-mar...
// Sin imports a propósito: se prueba con `node --test` (recurring.test.ts).

export type Freq = 'weekly' | 'monthly' | 'yearly'

const pad = (n: number) => String(n).padStart(2, '0')
const daysInMonth = (y: number, m0: number) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate()

/** n-ésima ocurrencia (desde 0) de `start` ("YYYY-MM-DD"). */
export function occurrence(start: string, freq: Freq, interval: number, n: number): string {
  const [y, m, d] = start.split('-').map(Number)
  if (freq === 'weekly') {
    return new Date(Date.UTC(y, m - 1, d + n * interval * 7)).toISOString().slice(0, 10)
  }
  const months = freq === 'monthly' ? n * interval : n * interval * 12
  const total = m - 1 + months
  const ty = y + Math.floor(total / 12)
  const tm0 = ((total % 12) + 12) % 12
  const td = Math.min(d, daysInMonth(ty, tm0))
  return `${ty}-${pad(tm0 + 1)}-${pad(td)}`
}

/** Próximas `count` fechas desde la ocurrencia `fromIndex`, respetando la fecha de término. */
export function upcoming(
  rule: { start_date: string; frequency: Freq; interval_count: number; end_date: string | null },
  fromIndex: number,
  count: number,
): string[] {
  const out: string[] = []
  for (let i = fromIndex; out.length < count; i++) {
    const d = occurrence(rule.start_date, rule.frequency, rule.interval_count, i)
    if (rule.end_date && d > rule.end_date) break
    out.push(d)
  }
  return out
}

/** Primera ocurrencia (desde `fromIndex`) en o después de `date`; null si la regla ya terminó. */
export function firstOnOrAfter(
  rule: { start_date: string; frequency: Freq; interval_count: number; end_date: string | null },
  fromIndex: number,
  date: string,
): string | null {
  for (let i = fromIndex; i < fromIndex + 5000; i++) {
    const d = occurrence(rule.start_date, rule.frequency, rule.interval_count, i)
    if (rule.end_date && d > rule.end_date) return null
    if (d >= date) return d
  }
  return null
}

/** "Cada mes, el día 5" / "Cada 2 semanas, los lunes" / "Cada año, el 14 de febrero" */
export function frequencyLabel(freq: Freq, interval: number, start: string): string {
  const [y, m, d] = start.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  if (freq === 'weekly') {
    const weekday = new Intl.DateTimeFormat('es-CL', { weekday: 'long', timeZone: 'UTC' }).format(date)
    return `${interval === 1 ? 'Cada semana' : `Cada ${interval} semanas`}, los ${weekday}`
  }
  if (freq === 'monthly') {
    const every = interval === 1 ? 'Cada mes' : `Cada ${interval} meses`
    return d >= 29 ? `${every}, el día ${d} (o el último día del mes)` : `${every}, el día ${d}`
  }
  const dayMonth = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date)
  return `${interval === 1 ? 'Cada año' : `Cada ${interval} años`}, el ${dayMonth}`
}
