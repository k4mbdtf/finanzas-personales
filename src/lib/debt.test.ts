import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cardStatus, loanStatus, receivableStatus, remainingFromInstallments } from './debt.ts'

const loan = { balance: 0, inflow: 0, loan_installment: null, loan_installments_count: null }

test('deuda en cuotas registrada con cuotas ya pagadas: parte en 4 de 24', () => {
  const debt = remainingFromInstallments(55000, 24, 4)
  assert.equal(debt, 1100000)
  const s = loanStatus({ ...loan, balance: -debt, loan_installment: 55000, loan_installments_count: 24 })
  assert.deepEqual(s.installments, { total: 24, paid: 4, left: 20 })
  assert.equal(s.pct, 16)
  assert.equal(s.paid, 0)
})

test('cada pago de una cuota avanza una cuota', () => {
  const s = loanStatus({ ...loan, balance: -1045000, inflow: 55000, loan_installment: 55000, loan_installments_count: 24 })
  assert.deepEqual(s.installments, { total: 24, paid: 5, left: 19 })
  assert.equal(s.paid, 55000)
})

test('un pago parcial no completa la cuota (redondea las restantes hacia arriba)', () => {
  const s = loanStatus({ ...loan, balance: -1060000, loan_installment: 55000, loan_installments_count: 24 })
  assert.equal(s.installments?.left, 20)
})

test('sin cuotas: avance = pagado / (pagado + lo que falta)', () => {
  const s = loanStatus({ ...loan, balance: -150000, inflow: 50000 })
  assert.deepEqual(s, { debt: 150000, paid: 50000, pct: 25, installments: null, installmentsLeft: null })
})

test('solo con el valor de la cuota estima las cuotas restantes', () => {
  assert.equal(loanStatus({ ...loan, balance: -120001, loan_installment: 40000 }).installmentsLeft, 4)
})

test('nunca muestra 100% si todavía se debe algo', () => {
  assert.equal(loanStatus({ ...loan, balance: -1, inflow: 999999 }).pct, 99)
  assert.equal(loanStatus({ ...loan, balance: -1, loan_installment: 10, loan_installments_count: 1000 }).pct, 99)
})

test('deuda pagada (o sobrepagada) queda en 100% y sin cuotas pendientes', () => {
  const s = loanStatus({ ...loan, balance: 1000, inflow: 500000, loan_installment: 50000, loan_installments_count: 10 })
  assert.equal(s.debt, 0)
  assert.equal(s.pct, 100)
  assert.deepEqual(s.installments, { total: 10, paid: 10, left: 0 })
})

test('deuda sin datos ni pagos: sin avance', () => {
  assert.equal(loanStatus({ ...loan, balance: 0 }).pct, null)
})

test('me deben: lo que falta, lo cobrado y el avance', () => {
  assert.deepEqual(receivableStatus({ balance: 30000, outflow: 10000 }), { owed: 30000, collected: 10000, pct: 25 })
  assert.deepEqual(receivableStatus({ balance: 0, outflow: 40000 }), { owed: 0, collected: 40000, pct: 100 })
  assert.deepEqual(receivableStatus({ balance: 0, outflow: 0 }), { owed: 0, collected: 0, pct: null })
})

test('tarjeta: cupo usado y disponible', () => {
  assert.deepEqual(cardStatus({ balance: -400000, credit_limit: 500000 }), { debt: 400000, available: 100000, usedPct: 80 })
  assert.deepEqual(cardStatus({ balance: -10, credit_limit: null }), { debt: 10, available: null, usedPct: null })
})
