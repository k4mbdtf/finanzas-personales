import { test } from 'node:test'
import assert from 'node:assert/strict'
import { goalStatus, monthsUntil } from './goals.ts'

test('meses hasta la fecha objetivo', () => {
  assert.equal(monthsUntil('2026-10-19', '2027-10-19'), 12)
  assert.equal(monthsUntil('2026-10-19', '2027-10-18'), 11)
  assert.equal(monthsUntil('2026-10-19', '2026-10-25'), 1) // futura pero < 1 mes
  assert.equal(monthsUntil('2026-10-19', '2026-10-19'), 0)
  assert.equal(monthsUntil('2026-10-19', '2026-01-01'), 0)
})

test('estado de una meta en curso', () => {
  assert.deepEqual(goalStatus(130000, 500000, '2027-10-19', '2026-10-19'),
    { remaining: 370000, pct: 26, done: false, months: 12, perMonth: 30834, overdue: false })
})

test('meta cumplida y meta vencida', () => {
  assert.equal(goalStatus(600000, 500000, null, '2026-10-19').done, true)
  assert.equal(goalStatus(600000, 500000, null, '2026-10-19').pct, 100)
  const late = goalStatus(100000, 500000, '2026-01-01', '2026-10-19')
  assert.equal(late.overdue, true)
  assert.equal(late.perMonth, null)
})

test('saldo negativo no da porcentaje negativo', () => {
  assert.equal(goalStatus(-5000, 100000, null, '2026-10-19').pct, 0)
})
