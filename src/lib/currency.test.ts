import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  balanceCLP, convertAmount, formatMoney, fromCLP, nativeBalance, needsRate, needsToValue, parseMoney, rateLabel, toCLP, txAmounts,
} from './currency.ts'

test('formato de cada moneda', () => {
  assert.equal(formatMoney(12500), '$12.500')
  assert.equal(formatMoney(-12500, 'CLP'), '-$12.500')
  assert.equal(formatMoney(15.5, 'UF'), 'UF 15,50')
  assert.equal(formatMoney(1234.567, 'UF'), 'UF 1.234,57')
  assert.equal(formatMoney(-20, 'USD'), '-US$20,00')
  assert.equal(formatMoney(-0.001, 'USD'), 'US$0,00')
})

test('leer montos: pesos solo dígitos; UF/USD con coma o punto decimal', () => {
  assert.equal(parseMoney('$12.500', 'CLP'), 12500)
  assert.equal(parseMoney('', 'CLP'), null)
  assert.equal(parseMoney('1.234,56', 'USD'), 1234.56)
  assert.equal(parseMoney('US$ 20,5', 'USD'), 20.5)
  assert.equal(parseMoney('1234.5', 'USD'), 1234.5)
  assert.equal(parseMoney('1.234', 'UF'), 1234)
  assert.equal(parseMoney('1.234.567', 'UF'), 1234567)
  assert.equal(parseMoney('15,256', 'UF'), 15.26)
  assert.equal(parseMoney('abc', 'UF'), null)
})

test('conversiones', () => {
  assert.equal(toCLP(20.5, 950.4), 19483)
  assert.equal(fromCLP(95000, 'USD', { USD: 950 }), 100)
  assert.equal(fromCLP(100000, 'UF', { UF: 39500 }), 2.53)
  assert.equal(fromCLP(100000, 'CLP', {}), 100000)
  assert.equal(fromCLP(100000, 'USD', {}), null)
})

test('saldo nativo y en pesos de hoy (sin valor del día: lo registrado en pesos)', () => {
  const usd = { currency: 'USD' as const, balance: 931000, balance_native: 979.5 }
  assert.equal(nativeBalance(usd), 979.5)
  assert.equal(balanceCLP(usd, { USD: 1000 }), 979500)
  assert.equal(balanceCLP(usd, {}), 931000)
  assert.equal(nativeBalance({ balance: 5000 }), 5000)
  assert.equal(balanceCLP({ currency: 'CLP', balance: 5000, balance_native: null }, { USD: 1000 }), 5000)
})

test('etiqueta del valor', () => {
  assert.equal(rateLabel('USD', 950), '1 USD = $950')
  assert.equal(rateLabel('UF', 39500.5), '1 UF = $39.500,5')
})

const rates = { USD: 950, UF: 39500 }

test('montos a guardar: en pesos, igual que siempre', () => {
  assert.deepEqual(txAmounts({ type: 'expense', from: 'CLP', to: null }, 12500, null, {}), { amount: 12500 })
  assert.deepEqual(txAmounts({ type: 'transfer', from: 'CLP', to: 'CLP' }, 5000, null, {}), { amount: 5000 })
})

test('gasto en una cuenta en dólares: pesos al valor del día y el monto en USD', () => {
  assert.deepEqual(txAmounts({ type: 'expense', from: 'USD', to: null }, 20.5, null, rates), { amount: 19475, amount_native: 20.5 })
  assert.equal(txAmounts({ type: 'expense', from: 'USD', to: null }, 20, null, {}), null)
})

test('transferencias entre monedas', () => {
  // Vendo 100 USD y llegan $93.000: los pesos son lo que llegó (no hace falta el valor del día).
  assert.deepEqual(txAmounts({ type: 'transfer', from: 'USD', to: 'CLP' }, 100, 93000, {}), { amount: 93000, amount_native: 100 })
  // Compro 50 USD con $48.000.
  assert.deepEqual(txAmounts({ type: 'transfer', from: 'CLP', to: 'USD' }, 48000, 50, {}), { amount: 48000, to_amount_native: 50 })
  // USD -> USD: llega lo mismo.
  assert.deepEqual(txAmounts({ type: 'transfer', from: 'USD', to: 'USD' }, 10, null, rates),
    { amount: 9500, amount_native: 10, to_amount_native: 10 })
  // USD -> UF.
  assert.deepEqual(txAmounts({ type: 'transfer', from: 'USD', to: 'UF' }, 100, 2.4, rates),
    { amount: 95000, amount_native: 100, to_amount_native: 2.4 })
  // Falta cuánto llegó.
  assert.equal(txAmounts({ type: 'transfer', from: 'CLP', to: 'USD' }, 48000, null, rates), null)
})

test('qué pide el formulario', () => {
  assert.equal(needsToValue({ type: 'transfer', from: 'CLP', to: 'USD' }), true)
  assert.equal(needsToValue({ type: 'transfer', from: 'USD', to: 'USD' }), false)
  assert.equal(needsToValue({ type: 'expense', from: 'USD', to: null }), false)
  assert.equal(needsRate({ type: 'expense', from: 'USD', to: null }), true)
  assert.equal(needsRate({ type: 'transfer', from: 'USD', to: 'CLP' }), false)
  assert.equal(needsRate({ type: 'transfer', from: 'CLP', to: 'USD' }), false)
})

test('convertir para precompletar', () => {
  assert.equal(convertAmount(100, 'USD', 'CLP', rates), 95000)
  assert.equal(convertAmount(95000, 'CLP', 'USD', rates), 100)
  assert.equal(convertAmount(100, 'USD', 'UF', rates), 2.41)
  assert.equal(convertAmount(100, 'USD', 'UF', {}), null)
  assert.equal(convertAmount(7, 'UF', 'UF', {}), 7)
})
