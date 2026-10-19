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

const oneDecimal = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 })

/** Para ejes de gráficos: 1500000 -> "$1,5 M", 85000 -> "$85 mil", 900 -> "$900" */
export function formatCLPCompact(amount: number): string {
  const sign = amount < 0 ? '-' : ''
  const n = Math.abs(amount)
  if (n >= 1_000_000) return `${sign}$${oneDecimal.format(n / 1_000_000)} M`
  if (n >= 1_000) return `${sign}$${oneDecimal.format(n / 1_000)} mil`
  return `${sign}$${n}`
}

/** 0.123 -> "12%" ; 0.0123 -> "1,2%" */
export function formatPct(ratio: number): string {
  const pct = Math.abs(ratio * 100)
  return `${pct.toLocaleString('es-CL', { maximumFractionDigits: pct < 10 ? 1 : 0 })}%`
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
