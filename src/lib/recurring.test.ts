// Pruebas unitarias: npm run test:unit
// Deben dar las mismas fechas que public.recurring_occurrence() en SQL
// (ver supabase/tests/20_etapa2.sql, sección 1).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { firstOnOrAfter, frequencyLabel, occurrence, upcoming } from './recurring.ts'

test('mensual sin deriva de fin de mes', () => {
  assert.equal(occurrence('2026-01-31', 'monthly', 1, 0), '2026-01-31')
  assert.equal(occurrence('2026-01-31', 'monthly', 1, 1), '2026-02-28')
  assert.equal(occurrence('2026-01-31', 'monthly', 1, 2), '2026-03-31')
  assert.equal(occurrence('2026-01-31', 'monthly', 1, 3), '2026-04-30')
  assert.equal(occurrence('2028-01-31', 'monthly', 1, 1), '2028-02-29') // bisiesto
})

test('mensual cruza de año y respeta el intervalo', () => {
  assert.equal(occurrence('2026-11-15', 'monthly', 1, 2), '2027-01-15')
  assert.equal(occurrence('2026-01-10', 'monthly', 3, 4), '2027-01-10')
})

test('semanal', () => {
  assert.equal(occurrence('2026-03-02', 'weekly', 2, 2), '2026-03-30')
  assert.equal(occurrence('2026-12-28', 'weekly', 1, 1), '2027-01-04')
})

test('anual con 29 de febrero', () => {
  assert.equal(occurrence('2024-02-29', 'yearly', 1, 1), '2025-02-28')
  assert.equal(occurrence('2024-02-29', 'yearly', 1, 4), '2028-02-29')
})

test('upcoming respeta la fecha de término', () => {
  const rule = { start_date: '2026-01-10', frequency: 'monthly' as const, interval_count: 1, end_date: '2026-03-10' }
  assert.deepEqual(upcoming(rule, 0, 5), ['2026-01-10', '2026-02-10', '2026-03-10'])
  assert.deepEqual(upcoming(rule, 2, 5), ['2026-03-10'])
  assert.deepEqual(upcoming(rule, 3, 5), [])
})

test('firstOnOrAfter salta las fechas pasadas (reactivar sin rellenar)', () => {
  const rule = { start_date: '2026-01-31', frequency: 'monthly' as const, interval_count: 1, end_date: null }
  assert.equal(firstOnOrAfter(rule, 0, '2026-04-15'), '2026-04-30')
  assert.equal(firstOnOrAfter(rule, 0, '2026-04-30'), '2026-04-30')
  assert.equal(firstOnOrAfter({ ...rule, end_date: '2026-03-31' }, 0, '2026-04-01'), null)
})

test('etiquetas de frecuencia', () => {
  assert.equal(frequencyLabel('monthly', 1, '2026-01-05'), 'Cada mes, el día 5')
  assert.equal(frequencyLabel('monthly', 2, '2026-01-31'), 'Cada 2 meses, el día 31 (o el último día del mes)')
  assert.equal(frequencyLabel('weekly', 2, '2026-03-02'), 'Cada 2 semanas, los lunes')
  assert.equal(frequencyLabel('yearly', 1, '2026-02-14'), 'Cada año, el 14 de febrero')
})
