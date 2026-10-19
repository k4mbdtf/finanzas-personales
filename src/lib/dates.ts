// Utilidades de meses y días. Un "mes" se representa como "YYYY-MM".
import { todayISO } from './format'

export function currentMonth(): string {
  return todayISO().slice(0, 7)
}

/** Primer y último día del mes: { from: '2026-10-01', to: '2026-10-31' } */
export function monthRange(ym: string): { from: string; to: string } {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` }
}

export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** "2026-10" -> "Octubre 2026" */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const s = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, 1)))
    .replace(' de ', ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Suma días a una fecha ISO. */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** "Hoy", "Ayer" o "lunes, 19 de octubre" (con año si no es el actual). */
export function dayLabel(iso: string): string {
  const today = todayISO()
  if (iso === today) return 'Hoy'
  if (iso === addDays(today, -1)) return 'Ayer'
  const [y, m, d] = iso.split('-').map(Number)
  const s = new Intl.DateTimeFormat('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long',
    year: y === Number(today.slice(0, 4)) ? undefined : 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)))
  return s.charAt(0).toUpperCase() + s.slice(1)
}
