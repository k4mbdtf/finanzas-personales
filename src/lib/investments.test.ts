import { test } from 'node:test'
import assert from 'node:assert/strict'
import { daysBetween, investmentGain, needsValuation, valueSeries } from './investments.ts'

test('ganancia y rentabilidad sobre lo aportado', () => {
  assert.deepEqual(investmentGain({ contributed: 1000000, withdrawn: 0, current_value: 1150000 }), { gain: 150000, pct: 0.15 })
  // Rescatar no es perder: 1.000.000 aportado, rescató 600.000 y quedan 600.000.
  assert.deepEqual(investmentGain({ contributed: 1000000, withdrawn: 600000, current_value: 600000 }), { gain: 200000, pct: 0.2 })
  assert.deepEqual(investmentGain({ contributed: 500000, withdrawn: 0, current_value: 450000 }), { gain: -50000, pct: -0.1 })
  assert.equal(investmentGain({ contributed: 0, withdrawn: 0, current_value: 0 }).pct, null)
})

test('días entre fechas (incluye cambio de mes y año)', () => {
  assert.equal(daysBetween('2026-01-31', '2026-03-01'), 29)
  assert.equal(daysBetween('2025-12-31', '2026-01-01'), 1)
})

test('cuándo conviene actualizar el valor', () => {
  const s = { contributed: 100000, withdrawn: 0, current_value: 100000 }
  assert.equal(needsValuation({ ...s, valued_at: null }, '2026-10-20'), true)
  assert.equal(needsValuation({ ...s, valued_at: '2026-10-01' }, '2026-10-20'), false)
  assert.equal(needsValuation({ ...s, valued_at: '2026-09-01' }, '2026-10-20'), true)
  assert.equal(needsValuation({ contributed: 100000, withdrawn: 100000, current_value: 0, valued_at: null }, '2026-10-20'), false,
    'una inversión rescatada completa no pide valor')
})

test('serie del gráfico con el mismo criterio que la BD', () => {
  // Igual que la prueba SQL: 100.000 iniciales, valorización 112.000 el 31-may a las 20:00,
  // aporte de 30.000 a las 21:00 (se suma), 5.000 a las 19:00 (ya incluido) y rescate de 10.000.
  const points = valueSeries(100000, '2026-05-01', [
    { date: '2026-05-31', created_at: '2026-06-01T01:00:00+00:00', delta: 30000 },
    { date: '2026-05-31', created_at: '2026-05-31T23:00:00+00:00', delta: 5000 },
    { date: '2026-06-10', created_at: '2026-06-10T12:00:00+00:00', delta: -10000 },
  ], [
    { date: '2026-05-31', created_at: '2026-06-01T00:00:00+00:00', value: 112000 },
  ], '2026-10-20')
  assert.deepEqual(points, [
    { date: '2026-05-01', value: 100000, invested: 100000 },
    { date: '2026-05-31', value: 142000, invested: 135000 },
    { date: '2026-06-10', value: 132000, invested: 125000 },
    { date: '2026-10-20', value: 132000, invested: 125000 },
  ])
})

test('sin aporte inicial la serie parte en el primer movimiento', () => {
  const points = valueSeries(0, '2026-07-03', [
    { date: '2026-07-03', created_at: '2026-07-03T12:00:00+00:00', delta: 300000 },
  ], [
    { date: '2026-07-03', created_at: '2026-07-03T12:00:00+00:00', value: 300000 },
    { date: '2026-08-01', created_at: '2026-08-01T12:00:00+00:00', value: 303000 },
  ])
  assert.deepEqual(points, [
    { date: '2026-07-03', value: 300000, invested: 300000 },
    { date: '2026-08-01', value: 303000, invested: 300000 },
  ])
})
