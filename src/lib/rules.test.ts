import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchRule, ruleKey } from './rules.ts'

const kinds: Record<string, 'income' | 'expense'> = { transporte: 'expense', comida: 'expense', sueldo: 'income' }
const kindOf = (id: string) => kinds[id]
const rules = [
  { id: '1', pattern: 'UBER', category_id: 'transporte' },
  { id: '2', pattern: 'Uber Eats', category_id: 'comida' },
  { id: '3', pattern: 'Remuneración', category_id: 'sueldo' },
  { id: '4', pattern: 'bip', category_id: 'transporte' },
  { id: '5', pattern: 'jumbo', category_id: 'borrada' },
]

test('normaliza mayúsculas, tildes y signos', () => {
  assert.equal(ruleKey('  Pago UBER *TRIP-123  '), 'pago uber trip 123')
  assert.equal(ruleKey('REMUNERACIÓN Octubre'), 'remuneracion octubre')
})

test('calza por palabras completas, sin importar mayúsculas, tildes ni signos', () => {
  assert.equal(matchRule(rules, 'PAGO UBER *TRIP 8812', 'expense', kindOf)?.id, '1')
  assert.equal(matchRule(rules, 'Carga BIP!', 'expense', kindOf)?.id, '4')
  assert.equal(matchRule(rules, 'Bipolar store', 'expense', kindOf), null)
  assert.equal(matchRule(rules, 'remuneracion oct', 'income', kindOf)?.id, '3')
})

test('si varias calzan, gana la más específica (texto más largo)', () => {
  assert.equal(matchRule(rules, 'UBER EATS PEDIDO', 'expense', kindOf)?.id, '2')
})

test('solo aplica al tipo de su categoría y a categorías que existen', () => {
  assert.equal(matchRule(rules, 'Remuneración', 'expense', kindOf), null)
  assert.equal(matchRule(rules, 'uber', 'income', kindOf), null)
  assert.equal(matchRule(rules, 'compra jumbo', 'expense', kindOf), null)
})

test('sin texto no hay regla', () => {
  assert.equal(matchRule(rules, null, 'expense', kindOf), null)
  assert.equal(matchRule(rules, '', 'expense', kindOf), null)
})
