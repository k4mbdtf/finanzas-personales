// Cálculos de deudas a partir del saldo de la cuenta (sin consultas).
// Sin imports a propósito: se prueba con `node --test` (debt.test.ts).

type DebtAccount = {
  type: string
  balance: number
  credit_limit: number | null
  loan_amount: number | null
  loan_installment: number | null
}

/** Lo que se debe hoy (nunca negativo). */
export const debtOf = (a: { balance: number }) => Math.max(0, -a.balance)

/** Préstamo: cuánto se ha pagado y cuántas cuotas faltan (estimado). */
export function loanStatus(a: DebtAccount) {
  const debt = debtOf(a)
  const paid = a.loan_amount != null ? Math.max(0, a.loan_amount - debt) : null
  const pct = a.loan_amount ? Math.min(100, Math.round(((a.loan_amount - debt) / a.loan_amount) * 100)) : null
  const installmentsLeft = a.loan_installment && debt > 0 ? Math.ceil(debt / a.loan_installment) : debt > 0 ? null : 0
  return { debt, paid, pct: pct != null ? Math.max(0, pct) : null, installmentsLeft }
}

/** Tarjeta: cupo usado y disponible. */
export function cardStatus(a: DebtAccount) {
  const debt = debtOf(a)
  const available = a.credit_limit != null ? a.credit_limit + a.balance : null
  const usedPct = a.credit_limit ? Math.min(100, Math.round((debt / a.credit_limit) * 100)) : null
  return { debt, available, usedPct }
}
