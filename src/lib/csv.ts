// Lectura de cartolas CSV de bancos chilenos (sin dependencias).
// Sin imports a propósito: se prueba con `node --test` (csv.test.ts).

/** Decodifica bytes: UTF-8 si es válido; si no, Windows-1252 (común en bancos). Quita el BOM. */
export function decodeText(bytes: ArrayBuffer | Uint8Array): string {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    text = new TextDecoder('windows-1252').decode(bytes)
  }
  return text.replace(/^﻿/, '')
}

/** Elige el separador más consistente entre ; , tab y | en las primeras líneas. */
export function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 30)
  let best = ','
  let bestScore = -1
  for (const d of [';', ',', '\t', '|']) {
    const counts = lines.map((l) => countOutsideQuotes(l, d)).filter((c) => c > 0)
    if (counts.length === 0) continue
    // Más líneas con el separador y conteos parecidos => mejor.
    const mode = mostCommon(counts)
    const score = counts.filter((c) => c === mode).length * 10 + mode
    if (score > bestScore) { bestScore = score; best = d }
  }
  return best
}

function countOutsideQuotes(line: string, d: string): number {
  let n = 0
  let q = false
  for (const ch of line) {
    if (ch === '"') q = !q
    else if (ch === d && !q) n++
  }
  return n
}

function mostCommon(xs: number[]): number {
  const m = new Map<number, number>()
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0]
}

/** CSV (RFC 4180): comillas, comillas dobles escapadas y saltos de línea dentro de campos. */
export function parseCSV(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else q = false
      } else field += ch
    } else if (ch === '"') {
      q = true
    } else if (ch === delimiter) {
      row.push(field); field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      rows.push(row); row = []
    } else field += ch
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows
    .map((r) => r.map((c) => c.trim()))
    .filter((r) => r.some((c) => c !== ''))
}

/**
 * Monto en formato chileno a entero (CLP). Acepta: "$12.500", "-12.500", "12.500,50",
 * "(12.500)", "12.500-", "1,234.56", "CLP 9.990". Devuelve null si no hay número.
 */
export function parseAmount(raw: string): number | null {
  let s = raw.replace(/\s|\$|clp/gi, '')
  if (!s) return null
  let negative = false
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1) }
  if (s.endsWith('-')) { negative = true; s = s.slice(0, -1) }
  if (s.startsWith('-')) { negative = !negative; s = s.slice(1) }
  else if (s.startsWith('+')) s = s.slice(1)
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null

  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  let decimalSep: '.' | ',' | null = null
  if (lastDot >= 0 && lastComma >= 0) decimalSep = lastDot > lastComma ? '.' : ','
  else if (lastComma >= 0) decimalSep = /,\d{1,2}$/.test(s) ? ',' : null // "12,50" vs "12,500"
  else if (lastDot >= 0) decimalSep = /^\d{1,3}(\.\d{3})+$/.test(s) ? null : /\.\d{1,2}$/.test(s) ? '.' : null

  let intPart = s
  let decPart = ''
  if (decimalSep) {
    const i = s.lastIndexOf(decimalSep)
    intPart = s.slice(0, i)
    decPart = s.slice(i + 1)
  }
  const digits = intPart.replace(/[.,]/g, '')
  if (!digits && !decPart) return null
  const value = Math.round(Number(`${digits || '0'}.${decPart || '0'}`))
  return negative ? -value : value
}

const MONTHS: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, sept: 9, set: 9, oct: 10, nov: 11, dic: 12,
  jan: 1, apr: 4, aug: 8, dec: 12,
}

export type DateOrder = 'dmy' | 'ymd' | 'mdy'

const pad = (n: number) => String(n).padStart(2, '0')

function validISO(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1) return null
  const max = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return d > max ? null : `${y}-${pad(m)}-${pad(d)}`
}

/** Fecha a "YYYY-MM-DD". Acepta 01/10/2026, 01-10-26, 2026-10-01, 01-oct-2026, 1 oct 2026 y con hora. */
export function parseDate(raw: string, order: DateOrder = 'dmy'): string | null {
  const s = raw.trim().toLowerCase().replace(/\./g, '/').split(/[ t](?=\d{1,2}:)/)[0].trim()
  let m = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
  if (m) return validISO(+m[1], +m[2], +m[3])
  m = s.match(/^(\d{1,2})[/\- ]([a-zñ]{3,4})[/\- ](\d{2,4})$/)
  if (m && MONTHS[m[2]]) return validISO(+m[3], MONTHS[m[2]], +m[1])
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (m) {
    const [a, b, y] = [+m[1], +m[2], +m[3]]
    return order === 'mdy' ? validISO(y, a, b) : validISO(y, b, a)
  }
  return null
}

/** Adivina el orden día/mes mirando los valores (si algún primer número > 12, es día). */
export function guessDateOrder(values: string[]): DateOrder {
  let firstOver12 = false
  let secondOver12 = false
  for (const v of values) {
    const m = v.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-]\d{2,4}/)
    if (!m) continue
    if (+m[1] > 12) firstOver12 = true
    if (+m[2] > 12) secondOver12 = true
  }
  return secondOver12 && !firstOver12 ? 'mdy' : 'dmy'
}

/** minúsculas, sin tildes, espacios colapsados. */
export function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Para sugerir categorías: sin números ni signos ("COMPRA JUMBO 1234" ~ "compra jumbo"). */
export function normalizeForMatch(s: string): string {
  return normalizeText(s).replace(/[^a-zñ ]/g, ' ').replace(/\s+/g, ' ').trim()
}

export type Mapping = {
  date: number
  description: number
  /** Una columna con signo, o dos columnas (cargo/abono). */
  amount: number | null
  debit: number | null
  credit: number | null
}

const KEYWORDS = {
  date: ['fecha', 'date', 'f. operacion', 'fecha operacion', 'fecha transaccion'],
  description: ['descripcion', 'glosa', 'detalle', 'concepto', 'movimiento', 'comercio', 'description', 'transaccion'],
  amount: ['monto', 'importe', 'amount', 'valor', 'total'],
  debit: ['cargo', 'cargos', 'debito', 'debitos', 'giro', 'giros', 'egreso', 'salida', 'retiro'],
  credit: ['abono', 'abonos', 'credito', 'creditos', 'deposito', 'depositos', 'ingreso', 'entrada'],
}

/** Adivina qué columna es cada cosa por el encabezado. -1 = no encontrada. */
export function guessMapping(headers: string[]): Mapping {
  const h = headers.map(normalizeText)
  const find = (keys: string[], exclude: number[] = []) =>
    h.findIndex((x, i) => !exclude.includes(i) && !x.includes('saldo') && keys.some((k) => x === k || x.startsWith(k) || x.includes(k)))
  const date = find(KEYWORDS.date)
  const debit = find(KEYWORDS.debit, [date])
  const credit = find(KEYWORDS.credit, [date, debit])
  const description = find(KEYWORDS.description, [date, debit, credit])
  const both = debit >= 0 && credit >= 0
  const amount = find(KEYWORDS.amount, [date, description])
  return {
    date,
    description,
    amount: !both && amount >= 0 ? amount : null,
    debit: both ? debit : null,
    credit: both ? credit : null,
  }
}

/** Fila de encabezado: la primera (de las 20 iniciales) seguida de una fila con fecha. */
export function guessHeaderRow(rows: string[][]): number {
  const limit = Math.min(rows.length - 1, 20)
  for (let i = 0; i < limit; i++) {
    const hasDate = (r: string[]) => r.some((c) => parseDate(c) !== null)
    const textCells = rows[i].filter((c) => c && parseAmount(c) === null && parseDate(c) === null).length
    if (textCells >= 2 && !hasDate(rows[i]) && hasDate(rows[i + 1])) return i
  }
  return 0
}
