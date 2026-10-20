import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TRANSFER_LABEL, isMoneyType, isTrackedType, transferKind } from './accounts.ts'

test('cuentas de dinero y de seguimiento', () => {
  for (const t of ['cash', 'bank', 'savings', 'credit_card']) {
    assert.equal(isMoneyType(t), true, t)
    assert.equal(isTrackedType(t), false, t)
  }
  for (const t of ['loan', 'receivable', 'investment']) {
    assert.equal(isMoneyType(t), false, t)
    assert.equal(isTrackedType(t), true, t)
  }
})

test('nombre de cada transferencia según sus cuentas', () => {
  const label = (from: string, to: string) => TRANSFER_LABEL[transferKind(from, to)]
  assert.equal(label('bank', 'loan'), 'Pago de deuda')
  assert.equal(label('loan', 'bank'), 'Préstamo recibido')
  assert.equal(label('bank', 'receivable'), 'Dinero prestado')
  assert.equal(label('receivable', 'cash'), 'Cobro de préstamo')
  assert.equal(label('bank', 'investment'), 'Aporte a inversión')
  assert.equal(label('investment', 'savings'), 'Rescate de inversión')
  assert.equal(label('bank', 'credit_card'), 'Pago de tarjeta')
  assert.equal(label('credit_card', 'bank'), 'Transferencia')
  assert.equal(label('bank', 'savings'), 'Transferencia')
})
