// Monedas: pesos (CLP), UF y dólares (USD). Los reportes van siempre en pesos; las
// cuentas en UF o USD guardan además su monto en esa moneda (migración 0009).
// Sin imports a propósito: se prueba con `node --test` (currency.test.ts).

export type Currency = 'CLP' | 'UF' | 'USD'
export type ForeignCurrency = Exclude<Currency, 'CLP'>
/** Valor en pesos de 1 UF y de 1 USD. */
export type Rates = Partial<Record<ForeignCurrency, number>>

export const CURRENCIES: Record<Currency, { label: string; name: string; decimals: number }> = {
  CLP: { label: 'Pesos', name: 'pesos', decimals: 0 },
  UF: { label: 'UF', name: 'UF', decimals: 2 },
  USD: { label: 'Dólares', name: 'dólares', decimals: 2 },
}

const fmt = (decimals: number) =>
  new Intl.NumberFormat('es-CL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
const FORMATS: Record<Currency, Intl.NumberFormat> = { CLP: fmt(0), UF: fmt(2), USD: fmt(2) }

/** 12500 CLP -> "$12.500"; 15.5 UF -> "UF 15,50"; -20 USD -> "-US$20,00". */
export function formatMoney(value: number, currency: Currency = 'CLP'): string {
  const abs = FORMATS[currency].format(Math.abs(currency === 'CLP' ? Math.round(value) : value))
  const sign = value < 0 && Math.abs(value) >= (currency === 'CLP' ? 0.5 : 0.005) ? '-' : ''
  return `${sign}${currency === 'CLP' ? '$' : currency === 'UF' ? 'UF ' : 'US$'}${abs}`
}

/**
 * Lee un monto escrito a mano. En pesos solo cuentan los dígitos. En UF/USD la coma es
 * el decimal ("1.234,56"); sin coma, un punto seguido de 1 o 2 dígitos al final también
 * ("1234.5"). Devuelve null si no hay dígitos.
 */
export function parseMoney(input: string, currency: Currency): number | null {
  if (currency === 'CLP') {
    const digits = input.replace(/\D/g, '')
    return digits ? Number.parseInt(digits, 10) : null
  }
  let s = input.replace(/[^\d.,]/g, '')
  if (!/\d/.test(s)) return null
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.').replace(/,/g, '')
  else if (!/\.\d{1,2}$/.test(s)) s = s.replace(/\./g, '')
  else s = s.replace(/\.(?=.*\.)/g, '')
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return null
  const f = 10 ** CURRENCIES[currency].decimals
  return Math.round(n * f) / f
}

/** Monto en pesos (entero) de un monto en otra moneda. */
export const toCLP = (value: number, rate: number) => Math.round(value * rate)

/** Pesos a la moneda pedida (con sus decimales). null si falta el valor de esa moneda. */
export function fromCLP(clp: number, currency: Currency, rates: Rates): number | null {
  if (currency === 'CLP') return clp
  const rate = rates[currency]
  if (!rate) return null
  const f = 10 ** CURRENCIES[currency].decimals
  return Math.round((clp / rate) * f) / f
}

type MaybeForeign = { currency?: Currency | null; balance: number; balance_native?: number | null }

export const currencyOf = (a: { currency?: Currency | null }): Currency => a.currency ?? 'CLP'

/** Saldo en la moneda de la cuenta. */
export function nativeBalance(a: MaybeForeign): number {
  return currencyOf(a) === 'CLP' ? a.balance : Number(a.balance_native ?? 0)
}

/**
 * Saldo de hoy en pesos: las cuentas en UF/USD se convierten con el valor de hoy. Si aún
 * no está ese valor, se usa la suma en pesos de sus movimientos (el valor de cada día).
 */
export function balanceCLP(a: MaybeForeign, rates: Rates): number {
  const cur = currencyOf(a)
  if (cur === 'CLP') return a.balance
  const rate = rates[cur]
  return rate ? toCLP(nativeBalance(a), rate) : a.balance
}

/** "1 USD = $950" / "1 UF = $39.500,50" */
export function rateLabel(currency: ForeignCurrency, rate: number): string {
  return `1 ${currency} = $${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(rate)}`
}

// ---------------------------------------------------------------------
// Montos de un movimiento según las monedas de sus cuentas (ver 0009_multimoneda.sql).
// ---------------------------------------------------------------------

type TxShape = { type: 'income' | 'expense' | 'transfer'; from: Currency; to: Currency | null }

/** Transferencia entre monedas distintas: se pide también cuánto llegó a la cuenta de destino. */
export const needsToValue = ({ type, from, to }: TxShape) => type === 'transfer' && to != null && to !== from

/** Hace falta el valor del día de la moneda de origen para saber cuántos pesos fueron. */
export const needsRate = ({ type, from, to }: TxShape) => from !== 'CLP' && !(type === 'transfer' && to === 'CLP')

/** Convierte un monto entre monedas con los valores del día (null si falta alguno). */
export function convertAmount(value: number, from: Currency, to: Currency, rates: Rates): number | null {
  if (from === to) return value
  const clp = from === 'CLP' ? value : rates[from] ? value * rates[from]! : null
  return clp == null ? null : fromCLP(Math.round(clp), to, rates)
}

export type TxAmounts = { amount: number; amount_native?: number; to_amount_native?: number }

/**
 * Lo que se guarda: `amount` en pesos y, si alguna cuenta es en UF/USD, su monto en esa
 * moneda. `fromValue` es lo ingresado en la moneda de origen; `toValue`, lo que llegó al
 * destino (solo transferencias entre monedas distintas). null si falta un dato.
 */
export function txAmounts(shape: TxShape, fromValue: number, toValue: number | null, rates: Rates): TxAmounts | null {
  const { type, from, to } = shape
  const crossTo = needsToValue(shape)
  if (crossTo && !toValue) return null
  if (from === 'CLP') {
    return crossTo ? { amount: fromValue, to_amount_native: toValue! } : { amount: fromValue }
  }
  if (type === 'transfer' && to === 'CLP') return { amount: toValue!, amount_native: fromValue }
  const rate = rates[from]
  if (!rate) return null
  const out: TxAmounts = { amount: toCLP(fromValue, rate), amount_native: fromValue }
  if (type === 'transfer') out.to_amount_native = crossTo ? toValue! : fromValue
  return out
}

/** Cuenta en pesos (recurrentes, cuotas, importación, metas y movimientos iniciales: solo en pesos por ahora). */
export const inPesos = (a: { currency?: Currency | null }) => currencyOf(a) === 'CLP'

/**
 * La cuenta con sus montos en su propia moneda, para usar los cálculos de deudas y tarjetas
 * (loanStatus, receivableStatus, cardStatus) tal cual: saldo en su moneda y, como lo
 * pagado/cobrado se registra en pesos, convertido al valor de hoy (aproximado).
 */
export function nativeView<T extends MaybeForeign & { inflow: number; outflow: number }>(a: T, rates: Rates): T {
  const cur = currencyOf(a)
  if (cur === 'CLP') return a
  const rate = rates[cur]
  const conv = (clp: number) => (rate ? Math.round((clp / rate) * 100) / 100 : 0)
  return { ...a, balance: nativeBalance(a), inflow: conv(a.inflow), outflow: conv(a.outflow) }
}
