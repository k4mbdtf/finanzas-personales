// Formato chileno: CLP sin decimales ($12.500) y fechas en America/Santiago.

export const TIMEZONE = 'America/Santiago'

const clp = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
})

/** 12500 -> "$12.500" ; -12500 -> "-$12.500" */
export function formatCLP(amount: number): string {
  return clp.format(Math.round(amount))
}

/** "$12.500" / "12.500" / "12500" -> 12500. Devuelve null si no hay dígitos. */
export function parseCLP(input: string): number | null {
  const digits = input.replace(/\D/g, '')
  return digits ? Number.parseInt(digits, 10) : null
}

/** Fecha de hoy en Santiago como "YYYY-MM-DD" (independiente de la zona del equipo). */
export function todayISO(): string {
  // en-CA produce formato ISO YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date())
}

/** "2026-10-19" -> "19 oct 2026" */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)))
}
