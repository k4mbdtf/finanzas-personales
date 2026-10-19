// Convierte la tabla de la cartola en movimientos y calcula su huella (hash).
// Sin imports de la app (solo ../../lib/csv.ts): se prueba con `node --test` (rows.test.ts).
import { normalizeText, parseAmount, parseDate, type DateOrder, type Mapping } from '../../lib/csv.ts'

export type ImportRow = {
  /** Número de fila en el archivo (1 = primera), para que el usuario la ubique. */
  line: number
  date: string | null
  description: string
  /** Con signo: negativo = gasto (cargo), positivo = ingreso (abono). */
  amount: number | null
  error: string | null
}

const cell = (r: string[], i: number | null) => (i != null && i >= 0 ? (r[i] ?? '').trim() : '')

export function buildRows(
  table: string[][], headerRow: number, m: Mapping, order: DateOrder, invert: boolean,
): ImportRow[] {
  const out: ImportRow[] = []
  for (let i = headerRow + 1; i < table.length; i++) {
    const r = table[i]
    const rawDate = cell(r, m.date)
    const description = cell(r, m.description).replace(/\s+/g, ' ')
    let amount: number | null
    if (m.amount != null) {
      amount = parseAmount(cell(r, m.amount))
    } else {
      const debit = parseAmount(cell(r, m.debit))
      const credit = parseAmount(cell(r, m.credit))
      amount = debit == null && credit == null ? null : Math.abs(credit ?? 0) - Math.abs(debit ?? 0)
    }
    if (!rawDate && !description && amount == null) continue // fila vacía
    if (amount != null && invert) amount = -amount
    const date = parseDate(rawDate, order)
    const error = !date ? 'Fecha no reconocida' : amount == null || amount === 0 ? 'Sin monto' : null
    out.push({ line: i + 1, date, description, amount, error })
  }
  return out
}

/**
 * Clave de cada fila válida. Dos filas idénticas en el mismo archivo (p. ej. dos
 * cafés iguales el mismo día) se distinguen con "#n", así no se pierden y
 * reimportar el archivo genera exactamente las mismas claves.
 */
export function rowKeys(accountId: string, rows: ImportRow[]): (string | null)[] {
  const seen = new Map<string, number>()
  return rows.map((r) => {
    if (r.error) return null
    const base = `${accountId}|${r.date}|${r.amount}|${normalizeText(r.description)}`
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return `${base}#${n}`
  })
}

/** SHA-256 en hexadecimal (Web Crypto, disponible en navegadores y Node 20+). */
export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
