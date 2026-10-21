// Piezas compartidas por la lista de deudas y su detalle.
import type { ReactNode } from 'react'
import { CircleCheck } from 'lucide-react'
import { currencyOf, formatMoney, nativeBalance, nativeView, type Rates } from '@/lib/currency'
import { debtOf, loanStatus } from '@/lib/debt'
import { useTransactionDrawer } from '@/features/transactions/TransactionDrawer'
import type { AccountWithBalance } from '@/types'

/** Texto de una deuda: "Cuota 4 de 24 · te quedan 20 · $55.000 al mes · paga el 10" (en su moneda). */
export function loanDetails(a: AccountWithBalance, rates: Rates): string {
  const s = loanStatus(nativeView(a, rates))
  const cur = currencyOf(a)
  return [
    s.installments ? `Cuota ${s.installments.paid} de ${s.installments.total}` : s.paid > 0 && `Pagado ${formatMoney(s.paid, cur)}`,
    s.installments && s.installments.left > 0 && `te ${s.installments.left === 1 ? 'queda 1' : `quedan ${s.installments.left}`}`,
    !s.installments && s.installmentsLeft != null && s.installmentsLeft > 0 && `~${s.installmentsLeft} cuotas restantes`,
    a.loan_installment && s.debt > 0 && `${formatMoney(Number(a.loan_installment), cur)} al mes`,
    a.payment_day && s.debt > 0 && `paga el ${a.payment_day}`,
  ].filter(Boolean).join(' · ')
}

/** Abre el registro de un pago, cobro o préstamo adicional ya completado. */
export function useDebtActions() {
  const { openNew } = useTransactionDrawer()
  return {
    // Deuda en UF/USD: se precompleta en su moneda lo que llega a la deuda (o sale de "me deben").
    pay: (a: AccountWithBalance) => {
      const native = currencyOf(a) !== 'CLP'
      const debt = debtOf({ balance: nativeBalance(a) })
      const cuota = a.loan_installment ? Math.min(Number(a.loan_installment), debt) || undefined : undefined
      openNew({
        type: 'transfer', to_account_id: a.id, note: `Pago ${a.name}`,
        ...(native ? { to_amount_native: cuota } : { amount: cuota }),
      }, 'Registrar pago')
    },
    collect: (a: AccountWithBalance) => {
      const owed = Math.max(0, nativeBalance(a)) || undefined
      openNew({
        type: 'transfer', account_id: a.id, note: `Cobro ${a.name}`,
        ...(currencyOf(a) !== 'CLP' ? { amount_native: owed } : { amount: owed }),
      }, 'Registrar cobro')
    },
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
