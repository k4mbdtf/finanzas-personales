// Piezas compartidas por la lista de deudas y su detalle.
import type { ReactNode } from 'react'
import { CircleCheck } from 'lucide-react'
import { debtOf, loanStatus } from '@/lib/debt'
import { formatCLP } from '@/lib/format'
import { useTransactionDrawer } from '@/features/transactions/TransactionDrawer'
import type { AccountWithBalance } from '@/types'

/** Texto de una deuda: "Cuota 4 de 24 · te quedan 20 · $55.000 al mes · paga el 10". */
export function loanDetails(a: AccountWithBalance): string {
  const s = loanStatus(a)
  return [
    s.installments ? `Cuota ${s.installments.paid} de ${s.installments.total}` : s.paid > 0 && `Pagado ${formatCLP(s.paid)}`,
    s.installments && s.installments.left > 0 && `te ${s.installments.left === 1 ? 'queda 1' : `quedan ${s.installments.left}`}`,
    !s.installments && s.installmentsLeft != null && s.installmentsLeft > 0 && `~${s.installmentsLeft} cuotas restantes`,
    a.loan_installment && s.debt > 0 && `${formatCLP(a.loan_installment)} al mes`,
    a.payment_day && s.debt > 0 && `paga el ${a.payment_day}`,
  ].filter(Boolean).join(' · ')
}

/** Abre el registro de un pago, cobro o préstamo adicional ya completado. */
export function useDebtActions() {
  const { openNew } = useTransactionDrawer()
  return {
    pay: (a: AccountWithBalance) => {
      const debt = debtOf(a)
      openNew({
        type: 'transfer', to_account_id: a.id, note: `Pago ${a.name}`,
        amount: a.loan_installment ? Math.min(a.loan_installment, debt) || undefined : undefined,
      }, 'Registrar pago')
    },
    collect: (a: AccountWithBalance) =>
      openNew({ type: 'transfer', account_id: a.id, amount: Math.max(0, a.balance) || undefined, note: `Cobro ${a.name}` }, 'Registrar cobro'),
    lendMore: (a: AccountWithBalance) =>
      openNew({ type: 'transfer', to_account_id: a.id, note: a.name }, 'Prestar más'),
  }
}

export function Done({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-xs font-medium text-pos">
      <CircleCheck size={14} strokeWidth={2.25} aria-hidden />{children}
    </p>
  )
}
