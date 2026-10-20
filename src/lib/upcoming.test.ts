import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addDaysISO, dueLabel, nextMonthlyDay, upcomingPayments } from './upcoming.ts'

const card = { id: 'c', name: 'Tarjeta CMR', type: 'credit_card', balance: -320000, archived: false, payment_day: 5 }
const rule = {
  id: 'r', type: 'expense' as const, amount: 25990, note: 'Internet', active: true,
  frequency: 'monthly' as const, interval_count: 1, start_date: '2026-01-12', end_date: null, occurrence_count: 10,
}
const base = { today: '2026-10-20', days: 30, accounts: [], rules: [], plans: [] }

test('próximo día de pago: este mes si no ha pasado, si no el siguiente, y ajusta meses cortos', () => {
  assert.equal(nextMonthlyDay('2026-10-20', 25), '2026-10-25')
  assert.equal(nextMonthlyDay('2026-10-20', 20), '2026-10-20')
  assert.equal(nextMonthlyDay('2026-10-20', 5), '2026-11-05')
  assert.equal(nextMonthlyDay('2026-01-31', 30), '2026-02-28')
  assert.equal(nextMonthlyDay('2026-12-15', 10), '2027-01-10')
  assert.equal(nextMonthlyDay('2028-02-01', 31), '2028-02-29')
})

test('tarjeta con deuda: pagar la deuda actual el día de pago; sin deuda o archivada no aparece', () => {
  const r = upcomingPayments({ ...base, accounts: [card, { ...card, id: 'x', balance: 0 }, { ...card, id: 'y', archived: true }] })
  assert.deepEqual(r.map((u) => [u.kind, u.date, u.amount, u.title]), [['card', '2026-11-05', 320000, 'Pagar Tarjeta CMR']])
})

test('préstamo: la cuota (o lo que queda si es menos); sin valor de cuota, monto desconocido', () => {
  const loan = { id: 'l', name: 'Crédito', type: 'loan', balance: -1100000, archived: false, payment_day: 25, loan_installment: 55000 }
  assert.deepEqual(upcomingPayments({ ...base, accounts: [loan] })[0], {
    kind: 'loan', date: '2026-10-25', title: 'Cuota Crédito', amount: 55000, detail: 'Cuota del préstamo', accountId: 'l', inTotal: true,
  })
  assert.equal(upcomingPayments({ ...base, accounts: [{ ...loan, balance: -30000 }] })[0].amount, 30000)
  assert.equal(upcomingPayments({ ...base, accounts: [{ ...loan, loan_installment: null }] })[0].amount, null)
})

test('fuera del período no aparece', () => {
  assert.deepEqual(upcomingPayments({ ...base, days: 10, accounts: [card] }), [])
})

test('recurrentes: gastos y transferencias activas dentro del período; ingresos y pausadas no', () => {
  const r = upcomingPayments({
    ...base,
    rules: [rule, { ...rule, id: 'i', type: 'income' }, { ...rule, id: 'p', active: false }, { ...rule, id: 't', type: 'transfer', note: null }],
    ruleTitle: (x) => x.note ?? 'Ahorro',
  })
  assert.deepEqual(r.map((u) => [u.ruleId, u.date, u.title, u.detail]), [
    ['r', '2026-11-12', 'Internet', 'Gasto recurrente'],
    ['t', '2026-11-12', 'Ahorro', 'Transferencia recurrente'],
  ])
})

test('recurrente semanal: todas sus fechas del período; respeta la fecha de término', () => {
  const weekly = { ...rule, frequency: 'weekly' as const, start_date: '2026-10-01', occurrence_count: 3 }
  assert.deepEqual(upcomingPayments({ ...base, days: 14, rules: [weekly] }).map((u) => u.date), ['2026-10-22', '2026-10-29'])
  assert.deepEqual(
    upcomingPayments({ ...base, days: 14, rules: [{ ...weekly, end_date: '2026-10-25' }] }).map((u) => u.date),
    ['2026-10-22'],
  )
})

test('cuotas: la próxima de cada compra, sin sumarse al total (van dentro del pago de la tarjeta)', () => {
  const plans = [
    { id: 'n', description: 'Notebook', installments_count: 12, paidCount: 2, next: { date: '2026-11-03', amount: 50000 } },
    { id: 'z', description: 'Pagada', installments_count: 3, paidCount: 3, next: null },
  ]
  const r = upcomingPayments({ ...base, plans })
  assert.equal(r.length, 1)
  assert.equal(r[0].detail, 'Cuota 3 de 12 · se carga a la tarjeta')
  assert.equal(r[0].inTotal, false)
})

test('orden por fecha y, el mismo día, el monto mayor primero', () => {
  const r = upcomingPayments({
    ...base,
    accounts: [{ ...card, payment_day: 12 }],
    rules: [rule, { ...rule, id: 'luz', note: 'Luz', start_date: '2026-01-02', amount: 40000 }],
  })
  assert.deepEqual(r.map((u) => u.title), ['Luz', 'Pagar Tarjeta CMR', 'Internet'])
})

test('etiquetas de vencimiento y suma de días', () => {
  assert.equal(dueLabel('2026-10-20', '2026-10-20'), 'Hoy')
  assert.equal(dueLabel('2026-10-20', '2026-10-21'), 'Mañana')
  assert.equal(dueLabel('2026-10-20', '2026-11-05'), 'En 16 días')
  assert.equal(addDaysISO('2026-12-25', 10), '2027-01-04')
})
