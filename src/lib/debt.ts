// Cálculos de deudas a partir del saldo y los movimientos de la cuenta (sin consultas).
// Sin imports a propósito: se prueba con `node --test` (debt.test.ts).

type LoanAccount = {
  balance: number
  /** Lo pagado: transferencias hacia la deuda. */
  inflow: number
  loan_installment: number | null
  loan_installments_count: number | null
}

/** Lo que se debe hoy (nunca negativo). */
export const debtOf = (a: { balance: number }) => Math.max(0, -a.balance)

export type LoanStatus = {
  debt: number
  /** Pagado desde que se registró en la app. */
  paid: number
  /** Avance de 0 a 100 (nunca 100 si aún se debe algo), o null si no hay con qué calcularlo. */
  pct: number | null
  /** Con valor y número de cuotas: cuotas pagadas y restantes (estimadas por el saldo). */
  installments: { total: number; paid: number; left: number } | null
  /** Cuotas que faltan (estimado). null si no se conoce el valor de la cuota. */
  installmentsLeft: number | null
}

/**
 * Avance de una deuda.
 *  * Con cuotas (valor y total): cuotas restantes = deuda ÷ cuota, hacia arriba.
 *    Así "24 cuotas, ya pagué 4" parte en 4 de 24 aunque se registre hoy.
 *  * Sin cuotas: lo pagado sobre (lo pagado + lo que falta).
 * El monto original no se usa: suele no incluir intereses y descuadraría el avance.
 */
export function loanStatus(a: LoanAccount): LoanStatus {
  const debt = debtOf(a)
  const paid = a.inflow
  const cuota = a.loan_installment
  const count = a.loan_installments_count
  if (cuota && count) {
    const left = debt > 0 ? Math.min(count, Math.ceil(debt / cuota)) : 0
    const paidCount = count - left
    return {
      debt, paid,
      pct: debt > 0 ? Math.floor((paidCount / count) * 100) : 100,
      installments: { total: count, paid: paidCount, left },
      installmentsLeft: left,
    }
  }
  const total = paid + debt
  return {
    debt, paid,
    pct: total === 0 ? null : debt > 0 ? Math.floor((paid / total) * 100) : 100,
    installments: null,
    installmentsLeft: debt === 0 ? 0 : cuota ? Math.ceil(debt / cuota) : null,
  }
}

export type ReceivableStatus = { owed: number; collected: number; pct: number | null }

/** "Me deben": lo que falta, lo ya cobrado (transferencias desde la cuenta) y el avance. */
export function receivableStatus(a: { balance: number; outflow: number }): ReceivableStatus {
  const owed = Math.max(0, a.balance)
  const collected = a.outflow
  const total = owed + collected
  return { owed, collected, pct: total === 0 ? null : owed > 0 ? Math.floor((collected / total) * 100) : 100 }
}

/** Tarjeta: cupo usado y disponible. */
export function cardStatus(a: { balance: number; credit_limit: number | null }) {
  const debt = debtOf(a)
  const available = a.credit_limit != null ? a.credit_limit + a.balance : null
  const usedPct = a.credit_limit ? Math.min(100, Math.round((debt / a.credit_limit) * 100)) : null
  return { debt, available, usedPct }
}

/** Deuda inicial para registrar una deuda en cuotas: (total − pagadas) × cuota. */
export const remainingFromInstallments = (cuota: number, total: number, paidBefore: number) =>
  Math.max(0, total - paidBefore) * cuota
