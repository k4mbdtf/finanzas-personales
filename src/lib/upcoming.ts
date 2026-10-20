// Próximos pagos: lo que vence en los próximos días, armado con lo que ya hay en la app
// (sin consultas): pago de tarjetas y préstamos según su día de pago, movimientos
// recurrentes de gasto o transferencia, y cuotas de compras en cuotas.
// Solo importa lógica pura: se prueba con `node --test` (upcoming.test.ts).
import { daysBetween } from './investments.ts'
import { firstOnOrAfter, occurrence, type Freq } from './recurring.ts'

export type UpcomingKind = 'card' | 'loan' | 'recurring' | 'installment'

export type Upcoming = {
  kind: UpcomingKind
  /** YYYY-MM-DD */
  date: string
  title: string
  /** null si no se sabe cuánto (p. ej. un préstamo sin valor de cuota). */
  amount: number | null
  detail: string
  /** Cuenta a pagar (tarjeta o préstamo) o regla recurrente. */
  accountId?: string
  ruleId?: string
  /** Las cuotas se cargan a la tarjeta: ya van dentro de su pago, no se suman al total. */
  inTotal: boolean
}

type DebtAccount = {
  id: string; name: string; type: string; balance: number; archived: boolean
  payment_day: number | null; loan_installment?: number | null
}
type Rule = {
  id: string; type: 'income' | 'expense' | 'transfer'; amount: number; note: string | null; active: boolean
  frequency: Freq; interval_count: number; start_date: string; end_date: string | null; occurrence_count: number
}
type Plan = { id: string; description: string; installments_count: number; paidCount: number; next: { date: string; amount: number } | null }

const pad = (n: number) => String(n).padStart(2, '0')
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

/** Suma días a "YYYY-MM-DD". */
export function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/**
 * Próxima fecha (hoy incluido) con ese día del mes. Si el mes es más corto, el último día
 * (día de pago 31 en febrero => 28 o 29).
 */
export function nextMonthlyDay(today: string, day: number): string {
  const [y, m, d] = today.split('-').map(Number)
  const thisMonth = Math.min(day, daysInMonth(y, m))
  if (thisMonth >= d) return `${y}-${pad(m)}-${pad(thisMonth)}`
  const ny = m === 12 ? y + 1 : y
  const nm = m === 12 ? 1 : m + 1
  return `${ny}-${pad(nm)}-${pad(Math.min(day, daysInMonth(ny, nm)))}`
}

/** Lo que vence entre hoy y hoy + `days` (incluidos), ordenado por fecha y luego por monto. */
export function upcomingPayments(input: {
  today: string
  days: number
  accounts: DebtAccount[]
  rules: Rule[]
  plans: Plan[]
  /** Nombre para mostrar de una regla (nota, categoría o cuenta). */
  ruleTitle?: (rule: Rule) => string
}): Upcoming[] {
  const { today } = input
  const until = addDaysISO(today, input.days)
  const out: Upcoming[] = []

  for (const a of input.accounts) {
    const debt = Math.max(0, -a.balance)
    if (a.archived || !a.payment_day || debt === 0) continue
    const date = nextMonthlyDay(today, a.payment_day)
    if (date > until) continue
    if (a.type === 'credit_card') {
      out.push({ kind: 'card', date, title: `Pagar ${a.name}`, amount: debt, detail: 'Deuda actual de la tarjeta', accountId: a.id, inTotal: true })
    } else if (a.type === 'loan') {
      const cuota = a.loan_installment ? Math.min(a.loan_installment, debt) : null
      out.push({ kind: 'loan', date, title: `Cuota ${a.name}`, amount: cuota, detail: cuota ? 'Cuota del préstamo' : 'Préstamo', accountId: a.id, inTotal: true })
    }
  }

  for (const r of input.rules) {
    if (!r.active || r.type === 'income') continue
    let i = r.occurrence_count
    let date = firstOnOrAfter(r, i, today)
    // Avanza hasta la ocurrencia encontrada para seguir desde ahí (reglas semanales: varias en el período).
    while (date && occurrence(r.start_date, r.frequency, r.interval_count, i) < date) i++
    while (date && date <= until) {
      out.push({
        kind: 'recurring', date, title: input.ruleTitle?.(r) ?? r.note ?? 'Movimiento recurrente', amount: r.amount,
        detail: r.type === 'transfer' ? 'Transferencia recurrente' : 'Gasto recurrente', ruleId: r.id, inTotal: true,
      })
      i++
      const next = occurrence(r.start_date, r.frequency, r.interval_count, i)
      date = r.end_date && next > r.end_date ? null : next
    }
  }

  for (const p of input.plans) {
    if (!p.next || p.next.date < today || p.next.date > until) continue
    out.push({
      kind: 'installment', date: p.next.date, title: p.description, amount: p.next.amount,
      detail: `Cuota ${p.paidCount + 1} de ${p.installments_count} · se carga a la tarjeta`, inTotal: false,
    })
  }

  return out.sort((a, b) => a.date.localeCompare(b.date) || (b.amount ?? 0) - (a.amount ?? 0))
}

/** "Hoy", "Mañana", "En 5 días". */
export function dueLabel(today: string, date: string): string {
  const n = daysBetween(today, date)
  return n <= 0 ? 'Hoy' : n === 1 ? 'Mañana' : `En ${n} días`
}
