// Tipos de cuenta: las "de dinero" (para gastar y transferir) y las "de
// seguimiento" (deudas, me deben e inversiones), que viven en sus propias
// secciones y solo se mueven con pagos, cobros, aportes y rescates.
// Sin imports a propósito: se prueba con `node --test` (accounts.test.ts).

export const MONEY_TYPES = ['cash', 'bank', 'savings', 'credit_card'] as const
export const DEBT_TYPES = ['loan', 'receivable'] as const

/** Efectivo, banco, ahorro o tarjeta: aparece en Cuentas y en los formularios. */
export const isMoneyType = (type: string) => (MONEY_TYPES as readonly string[]).includes(type)
export const isDebtType = (type: string) => (DEBT_TYPES as readonly string[]).includes(type)
/** Deuda, "me deben" o inversión: no tiene ingresos ni gastos propios. */
export const isTrackedType = (type: string) => !isMoneyType(type)

export type TransferKind =
  | 'card_payment' | 'debt_payment' | 'loan_received' | 'lent' | 'collected'
  | 'contribution' | 'withdrawal' | 'transfer'

/** Qué es una transferencia según el tipo de sus cuentas (origen → destino). */
export function transferKind(fromType: string | undefined, toType: string | undefined): TransferKind {
  if (toType === 'loan') return 'debt_payment'
  if (fromType === 'loan') return 'loan_received'
  if (toType === 'receivable') return 'lent'
  if (fromType === 'receivable') return 'collected'
  if (toType === 'investment') return 'contribution'
  if (fromType === 'investment') return 'withdrawal'
  if (toType === 'credit_card') return 'card_payment'
  return 'transfer'
}

export const TRANSFER_LABEL: Record<TransferKind, string> = {
  card_payment: 'Pago de tarjeta',
  debt_payment: 'Pago de deuda',
  loan_received: 'Préstamo recibido',
  lent: 'Dinero prestado',
  collected: 'Cobro de préstamo',
  contribution: 'Aporte a inversión',
  withdrawal: 'Rescate de inversión',
  transfer: 'Transferencia',
}
