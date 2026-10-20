import { test } from 'node:test'
import assert from 'node:assert/strict'
import { categoryComparison, highlights, yearTotals } from './yearSummary.ts'

const months = [
  { month: '2026-01', income: 1_000_000, expense: 700_000 },
  { month: '2026-02', income: 1_000_000, expense: 1_100_000 },
  { month: '2026-03', income: 1_200_000, expense: 600_000 },
  { month: '2026-04', income: 0, expense: 0 },
]

test('totales del año, tasa de ahorro y promedio solo de meses con movimientos', () => {
  assert.deepEqual(yearTotals(months), {
    income: 3_200_000, expense: 2_400_000, saving: 800_000, savingRate: 0.25, activeMonths: 3, avgExpense: 800_000,
  })
})

test('año sin movimientos: sin tasa de ahorro ni promedio', () => {
  const t = yearTotals([{ month: '2026-01', income: 0, expense: 0 }])
  assert.equal(t.savingRate, null)
  assert.equal(t.avgExpense, 0)
})

test('meses destacados: el de más gasto y el de más ahorro', () => {
  const h = highlights(months)
  assert.equal(h.maxExpense?.month, '2026-02')
  assert.equal(h.bestSaving?.month, '2026-03')
  assert.deepEqual(highlights([{ month: '2026-01', income: 0, expense: 0 }]), { maxExpense: null, bestSaving: null })
})

test('categorías: de mayor a menor, % del total, diferencia con el año anterior y las que ya no tienen gasto al final', () => {
  const rows = categoryComparison(
    new Map([['comida', 600_000], ['transporte', 200_000], ['', 200_000]]),
    new Map([['comida', 500_000], ['viajes', 300_000]]),
  )
  assert.deepEqual(rows.map((r) => [r.categoryId, r.amount, r.share, r.previous, r.diff]), [
    ['comida', 600_000, 0.6, 500_000, 100_000],
    ['transporte', 200_000, 0.2, 0, 200_000],
    ['', 200_000, 0.2, 0, 200_000],
    ['viajes', 0, 0, 300_000, -300_000],
  ])
})
