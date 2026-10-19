import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  decodeText, detectDelimiter, guessDateOrder, guessHeaderRow, guessMapping, normalizeForMatch,
  parseAmount, parseCSV, parseDate,
} from './csv.ts'

test('montos en formato chileno', () => {
  assert.equal(parseAmount('$12.500'), 12500)
  assert.equal(parseAmount('12.500'), 12500)
  assert.equal(parseAmount('1.234.567'), 1234567)
  assert.equal(parseAmount('-12.500'), -12500)
  assert.equal(parseAmount('12.500-'), -12500)
  assert.equal(parseAmount('(12.500)'), -12500)
  assert.equal(parseAmount('12.500,50'), 12501) // redondea
  assert.equal(parseAmount('12.500,49'), 12500)
  assert.equal(parseAmount('1,234.56'), 1235)
  assert.equal(parseAmount('12,500'), 12500) // coma de miles
  assert.equal(parseAmount('12,5'), 13)
  assert.equal(parseAmount('CLP 9.990'), 9990)
  assert.equal(parseAmount('$ -3.000'), -3000)
  assert.equal(parseAmount('9990'), 9990)
  assert.equal(parseAmount('0'), 0)
  assert.equal(parseAmount(''), null)
  assert.equal(parseAmount('abc'), null)
  assert.equal(parseAmount('12/10/2026'), null)
})

test('fechas', () => {
  assert.equal(parseDate('01/10/2026'), '2026-10-01')
  assert.equal(parseDate('1-10-26'), '2026-10-01')
  assert.equal(parseDate('01.10.2026'), '2026-10-01')
  assert.equal(parseDate('2026-10-01'), '2026-10-01')
  assert.equal(parseDate('2026/10/01 13:45:00'), '2026-10-01')
  assert.equal(parseDate('01-oct-2026'), '2026-10-01')
  assert.equal(parseDate('5 Sept 2026'), '2026-09-05')
  assert.equal(parseDate('10/01/2026', 'mdy'), '2026-10-01')
  assert.equal(parseDate('31/02/2026'), null)
  assert.equal(parseDate('JUMBO'), null)
  assert.equal(parseDate('12.500'), null)
})

test('orden de fecha', () => {
  assert.equal(guessDateOrder(['01/10/2026', '25/10/2026']), 'dmy')
  assert.equal(guessDateOrder(['10/01/2026', '10/25/2026']), 'mdy')
  assert.equal(guessDateOrder(['01/02/2026']), 'dmy') // ambiguo => Chile
})

test('separador y CSV con comillas', () => {
  assert.equal(detectDelimiter('Fecha;Detalle;Monto\n01/10/2026;"Pan; leche";-1.500\n02/10/2026;Metro;-800'), ';')
  assert.equal(detectDelimiter('Fecha,Detalle,Monto\n01/10/2026,"Jumbo, Las Condes",-1500'), ',')
  assert.equal(detectDelimiter('Fecha\tDetalle\tMonto\n01/10/2026\tJumbo\t-1500'), '\t')
  assert.deepEqual(parseCSV('a;"b ""c"";d"\r\n1;"x\ny"\n\n', ';'), [['a', 'b "c";d'], ['1', 'x\ny']])
})

test('decodifica Windows-1252 (tildes de bancos antiguos)', () => {
  const latin1 = new Uint8Array([0x44, 0x65, 0x73, 0x63, 0x72, 0x69, 0x70, 0x63, 0x69, 0xf3, 0x6e]) // "Descripción"
  assert.equal(decodeText(latin1), 'Descripción')
  const utf8 = new TextEncoder().encode('﻿Año')
  assert.equal(decodeText(utf8), 'Año')
})

test('columnas por encabezado', () => {
  assert.deepEqual(guessMapping(['Fecha', 'Descripción', 'Monto', 'Saldo']),
    { date: 0, description: 1, amount: 2, debit: null, credit: null })
  assert.deepEqual(guessMapping(['Fecha', 'N° Documento', 'Glosa', 'Cargos ($)', 'Abonos ($)', 'Saldo ($)']),
    { date: 0, description: 2, amount: null, debit: 3, credit: 4 })
})

test('fila de encabezado tras un preámbulo', () => {
  const rows = [
    ['Banco Ejemplo'], ['Cuenta', '12345'], ['Fecha', 'Descripción', 'Cargo', 'Abono', 'Saldo'],
    ['01/10/2026', 'JUMBO', '12.500', '', '100.000'],
  ]
  assert.equal(guessHeaderRow(rows), 2)
})

test('normalizar para sugerir categoría', () => {
  assert.equal(normalizeForMatch('COMPRA JUMBO 1234 Ñuñoa'), 'compra jumbo nunoa')
})
