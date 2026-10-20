import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextPart, splitStatus } from './split.ts'

test('partes que suman el total y tienen categoría: se puede guardar', () => {
  assert.deepEqual(splitStatus(50000, [{ categoryId: 'a', amount: 30000 }, { categoryId: 'b', amount: 20000 }]),
    { assigned: 50000, remaining: 0, error: '' })
})

test('errores en orden: pocas partes, sin categoría, sin monto, repetida, no cuadra', () => {
  const err = (parts: Parameters<typeof splitStatus>[1], total = 10) => splitStatus(total, parts).error
  assert.equal(err([{ categoryId: 'a', amount: 10 }]), 'Divide en al menos 2 partes.')
  assert.equal(err([{ categoryId: 'a', amount: 5 }, { categoryId: null, amount: 5 }]), 'Elige la categoría de cada parte.')
  assert.equal(err([{ categoryId: 'a', amount: 10 }, { categoryId: 'b', amount: null }]), 'Cada parte necesita un monto mayor a $0.')
  assert.equal(err([{ categoryId: 'a', amount: 5 }, { categoryId: 'a', amount: 5 }]), 'Usa una categoría distinta en cada parte.')
  assert.equal(err([{ categoryId: 'a', amount: 5 }, { categoryId: 'b', amount: 6 }]), 'Las partes deben sumar el total.')
})

test('lo que falta o sobra', () => {
  assert.equal(splitStatus(10, [{ categoryId: 'a', amount: 4 }, { categoryId: 'b', amount: 3 }]).remaining, 3)
  assert.equal(splitStatus(10, [{ categoryId: 'a', amount: 8 }, { categoryId: 'b', amount: 3 }]).remaining, -1)
  assert.equal(splitStatus(null, [{ categoryId: 'a', amount: 8 }]).remaining, -8)
})

test('una parte nueva parte con lo que falta repartir', () => {
  assert.deepEqual(nextPart(10, [{ categoryId: 'a', amount: 4 }]), { categoryId: null, amount: 6 })
  assert.deepEqual(nextPart(10, [{ categoryId: 'a', amount: 10 }]), { categoryId: null, amount: null })
})
