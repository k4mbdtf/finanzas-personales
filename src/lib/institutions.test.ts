import { test } from 'node:test'
import assert from 'node:assert/strict'
import { INSTITUTIONS, findInstitution, inkOn, institutionById, productAccountName } from './institutions.ts'

test('ids únicos y con el formato que acepta la BD', () => {
  const ids = INSTITUTIONS.map((i) => i.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const id of ids) assert.match(id, /^[a-z0-9-]{1,40}$/)
  for (const i of INSTITUTIONS) {
    assert.match(i.color, /^#[0-9a-f]{6}$/, i.id)
    assert.ok(i.products.length > 0, i.id)
  }
})

test('nombre sugerido de la cuenta', () => {
  const be = institutionById('bancoestado')!
  assert.equal(productAccountName(be, be.products[0]), 'BancoEstado CuentaRUT')
  const f = institutionById('falabella')!
  assert.equal(productAccountName(f, f.products.find((p) => p.id === 'corriente')!), 'Falabella Cuenta Corriente')
  assert.equal(productAccountName(f, f.products.find((p) => p.id === 'debito')!), 'Falabella Débito')
  assert.equal(productAccountName(f, f.products.find((p) => p.type === 'credit_card')!), 'CMR Falabella')
})

test('reconoce bancos escritos a mano', () => {
  assert.equal(findInstitution('Banco Estado')?.id, 'bancoestado')
  assert.equal(findInstitution('  bancoestado ')?.id, 'bancoestado')
  assert.equal(findInstitution('Itau')?.id, 'itau')
  assert.equal(findInstitution('Banco de Chile')?.id, 'bancochile')
  assert.equal(findInstitution('CMR')?.id, 'falabella')
  assert.equal(findInstitution('Juan'), undefined)
  assert.equal(findInstitution(''), undefined)
})

test('el monograma usa el color con más contraste', () => {
  assert.equal(inkOn('#ffe600'), '#1c1c1c')
  assert.equal(inkOn('#002d72'), '#ffffff')
  assert.equal(inkOn('#c8102e'), '#ffffff')
})
