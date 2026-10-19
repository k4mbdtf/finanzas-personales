import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildRows, rowKeys, sha256 } from './rows.ts'

const one = { date: 0, description: 1, amount: 2, debit: null, credit: null }
const two = { date: 0, description: 1, amount: null, debit: 2, credit: 3 }

test('una columna de monto con signo', () => {
  const t = [['Fecha', 'Detalle', 'Monto'], ['01/10/2026', 'JUMBO  LAS CONDES', '-12.500'], ['02/10/2026', 'SUELDO', '800.000']]
  assert.deepEqual(buildRows(t, 0, one, 'dmy', false), [
    { line: 2, date: '2026-10-01', description: 'JUMBO LAS CONDES', amount: -12500, error: null },
    { line: 3, date: '2026-10-02', description: 'SUELDO', amount: 800000, error: null },
  ])
})

test('columnas de cargo y abono', () => {
  const t = [['Fecha', 'Glosa', 'Cargos', 'Abonos'], ['01/10/2026', 'METRO', '800', ''], ['02/10/2026', 'TRANSF', '', '50.000']]
  const rows = buildRows(t, 0, two, 'dmy', false)
  assert.deepEqual(rows.map((r) => r.amount), [-800, 50000])
})

test('invertir signos (cartola de tarjeta con cargos positivos)', () => {
  const t = [['F', 'D', 'M'], ['01/10/2026', 'NETFLIX', '9.990']]
  assert.equal(buildRows(t, 0, one, 'dmy', true)[0].amount, -9990)
})

test('filas inválidas quedan marcadas y las vacías se omiten', () => {
  const t = [['F', 'D', 'M'], ['', '', ''], ['Total', '', '100.000'], ['03/10/2026', 'X', '0']]
  const rows = buildRows(t, 0, one, 'dmy', false)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].error, 'Fecha no reconocida')
  assert.equal(rows[1].error, 'Sin monto')
})

test('filas idénticas reciben claves distintas y estables', () => {
  const t = [['F', 'D', 'M'], ['01/10/2026', 'Café', '-2.500'], ['01/10/2026', 'CAFÉ', '-2.500'], ['bad', 'x', '1']]
  const rows = buildRows(t, 0, one, 'dmy', false)
  const keys = rowKeys('acc1', rows)
  assert.deepEqual(keys, ['acc1|2026-10-01|-2500|cafe#1', 'acc1|2026-10-01|-2500|cafe#2', null])
  assert.deepEqual(rowKeys('acc1', rows), keys) // misma entrada => mismas claves
  assert.notDeepEqual(rowKeys('acc2', rows), keys) // otra cuenta => otras claves
})

test('sha256 hexadecimal', async () => {
  assert.equal(await sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
})
