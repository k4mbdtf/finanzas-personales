// Detalle de una deuda o de un "me deben": cuánto falta, el avance, sus datos
// y todos sus pagos o cobros (tocar uno lo abre para editarlo).
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Archive, ArchiveRestore, HandCoins, Pencil } from 'lucide-react'
import { useRefData } from '@/context/RefData'
import { updateAccount } from '@/data/accounts'
import { listTransactions } from '@/data/transactions'
import { useQuery } from '@/hooks/useQuery'
import { isDebtType } from '@/lib/accounts'
import { loanStatus, receivableStatus } from '@/lib/debt'
import { CURRENCIES, currencyOf, formatMoney, nativeView } from '@/lib/currency'
import { formatCLP } from '@/lib/format'
import { ACCOUNT_TYPES } from '@/lib/icons'
import { useAnimatedNumber } from '@/lib/motion'
import { BackLink } from '@/components/BackLink'
import { useToast } from '@/components/Feedback'
import { AccountIcon } from '@/components/icons'
import { Modal } from '@/components/Modal'
import { ProgressBar } from '@/components/ProgressBar'
import { Alert, Button, Card, EmptyState, Loading, SectionHeader } from '@/components/ui'
import { TransactionList } from '@/features/transactions/TransactionList'
import { useTransactionDrawer } from '@/features/transactions/TransactionDrawer'
import type { AccountWithBalance } from '@/types'
import { DebtForm } from './DebtForm'
import { Done, loanDetails, useDebtActions } from './debtShared'

export default function DebtDetailPage() {
  const { id = '' } = useParams()
  const { accountById, loading } = useRefData()
  const a = accountById.get(id)
  if (loading) return <Loading label="Cargando…" />
  if (!a || !isDebtType(a.type)) {
    return (
      <EmptyState icon={HandCoins} title="No encontramos esta deuda"
        action={<Link to="/deudas" className="link">Volver a Deudas</Link>}>
        Puede que la hayas eliminado.
      </EmptyState>
    )
  }
  return <Detail key={a.id} debt={a} />
}

function Detail({ debt: a }: { debt: AccountWithBalance }) {
  const navigate = useNavigate()
  const toast = useToast()
  const actions = useDebtActions()
  const { openEdit } = useTransactionDrawer()
  const [editing, setEditing] = useState(false)
  const moves = useQuery(
    () => listTransactions({ from: '1900-01-01', to: '2999-12-31', accountId: a.id }, 300),
    [a.id], ['transactions'],
  )
  const { rates } = useRefData()
  const isLoan = a.type === 'loan'
  // Deuda en UF/USD: todo en su moneda (lo pagado, convertido al valor de hoy).
  const cur = currencyOf(a)
  const view = nativeView(a, rates)
  const loan = loanStatus(view)
  const recv = receivableStatus(view)
  const amount = isLoan ? loan.debt : recv.owed
  const shown = useAnimatedNumber(amount)
  const money = (v: number) => formatMoney(v, cur)
  const pct = isLoan ? loan.pct : recv.collected > 0 ? recv.pct : null

  async function toggleArchive() {
    try {
      await updateAccount(a.id, { archived: !a.archived })
      toast(a.archived ? 'Volvió a la lista' : 'Archivada')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo guardar.', 'error')
    }
  }

  const facts: [string, ReactNode][] = []
  if (isLoan) {
    facts.push(['Pagado aquí', cur === 'CLP' ? formatCLP(loan.paid) : `${formatCLP(a.inflow)} (≈ ${money(loan.paid)})`])
    if (loan.installments) facts.push(['Cuotas', `${loan.installments.paid} de ${loan.installments.total}`])
    if (a.loan_installment) facts.push(['Cuota', money(Number(a.loan_installment))])
    if (a.payment_day) facts.push(['Día de pago', `${a.payment_day} de cada mes`])
    if (a.interest_rate != null) facts.push(['Tasa anual', `${String(a.interest_rate).replace('.', ',')}%`])
    if (a.loan_amount) facts.push(['Monto que pediste', money(Number(a.loan_amount))])
    if (cur !== 'CLP') facts.push(['Moneda', CURRENCIES[cur].label])
  } else {
    facts.push(['Te han devuelto', money(recv.collected)], ['Prestado en total', money(recv.collected + recv.owed)])
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <BackLink to="/deudas">Deudas</BackLink>
        <header className="flex items-center gap-4">
          <AccountIcon account={a} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="line-clamp-2 text-[1.625rem] leading-tight font-bold tracking-[-0.03em] break-words md:text-[1.875rem]">{a.name}</h1>
            <p className="truncate text-sm text-muted">
              {[isLoan ? 'Deuda' : ACCOUNT_TYPES[a.type].label, a.counterparty, a.archived && 'Archivada'].filter(Boolean).join(' · ')}
            </p>
          </div>
          <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditing(true)}>Editar</Button>
        </header>
      </div>

      <Card className="flex flex-col gap-5">
        <div>
          <p className="label-caps">{isLoan ? 'Debes' : 'Te deben'}</p>
          <p className={`figure-hero mt-1 text-[2.25rem] leading-none md:text-[2.75rem] ${amount > 0 ? (isLoan ? 'text-neg' : 'text-pos') : ''}`}>
            {cur === 'CLP'
              ? <><span className="sr-only">{formatCLP(amount)}</span><span aria-hidden>{formatCLP(shown)}</span></>
              : money(amount)}
          </p>
        </div>
        {pct != null && (
          <div className="flex flex-col gap-2">
            <ProgressBar thick pct={pct} label={`${pct}% ${isLoan ? 'pagado' : 'devuelto'}`} barClass="bg-pos-bar" />
            {amount === 0
              ? <Done>{isLoan ? 'Pagada' : 'Te pagaron todo'}</Done>
              : <p className="text-sm text-soft">{isLoan ? loanDetails(a, rates) || `${pct}% pagado` : `${pct}% devuelto`}</p>}
          </div>
        )}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 sm:grid-cols-3">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-2">
          {amount > 0 && (isLoan
            ? <Button onClick={() => actions.pay(a)}>Registrar pago</Button>
            : <>
              <Button onClick={() => actions.collect(a)}>Registrar cobro</Button>
              <Button variant="secondary" onClick={() => actions.lendMore(a)}>Prestar más</Button>
            </>)}
          {(amount === 0 || a.archived) && (
            <Button variant="secondary" icon={a.archived ? ArchiveRestore : Archive} onClick={toggleArchive}>
              {a.archived ? 'Volver a la lista' : 'Archivar'}
            </Button>
          )}
        </div>
      </Card>

      <section aria-labelledby="movs">
        <SectionHeader id="movs" title={isLoan ? 'Pagos y movimientos' : 'Préstamos y cobros'} />
        {moves.error && <Alert>{moves.error}</Alert>}
        {moves.loading && !moves.data ? <Loading rows={3} />
          : moves.data && moves.data.rows.length > 0
            ? <TransactionList rows={moves.data.rows} onSelect={openEdit} />
            : <p className="text-sm text-soft">{isLoan ? 'Aún no hay pagos registrados.' : 'Aún no hay cobros registrados.'}</p>}
      </section>

      <Modal open={editing} onClose={() => setEditing(false)} title="Editar">
        {editing && <DebtForm debt={a} onDone={() => setEditing(false)} onDeleted={() => navigate('/deudas', { replace: true })} />}
      </Modal>
    </div>
  )
}
