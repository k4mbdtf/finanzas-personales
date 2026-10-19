import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cardStatus, loanStatus } from './debt.ts'

const base = { type: 'loan', credit_limit: null, loan_amount: null, loan_installment: null }

test('préstamo con monto original y cuota', () => {
  const s = loanStatus({ ...base, balance: -800000, loan_amount: 1000000, loan_installment: 50000 })
  assert.deepEqual(s, { debt: 800000, paid: 200000, pct: 20, installmentsLeft: 16 })
})

test('préstamo sin datos opcionales', () => {
  assert.deepEqual(loanStatus({ ...base, balance: -300000 }), { debt: 300000, paid: null, pct: null, installmentsLeft: null })
})

test('préstamo pagado (o sobrepagado)', () => {
  const s = loanStatus({ ...base, balance: 1000, loan_amount: 500000, loan_installment: 50000 })
  assert.deepEqual(s, { debt: 0, paid: 500000, pct: 100, installmentsLeft: 0 })
})

test('cuota que no divide exacto redondea hacia arriba', () => {
  assert.equal(loanStatus({ ...base, balance: -120001, loan_installment: 40000 }).installmentsLeft, 4)
})

test('tarjeta: cupo usado y disponible', () => {
  assert.deepEqual(cardStatus({ ...base, type: 'credit_card', balance: -400000, credit_limit: 500000 }),
    { debt: 400000, available: 100000, usedPct: 80 })
  assert.deepEqual(cardStatus({ ...base, type: 'credit_card', balance: -10, credit_limit: null }),
    { debt: 10, available: null, usedPct: null })
})
