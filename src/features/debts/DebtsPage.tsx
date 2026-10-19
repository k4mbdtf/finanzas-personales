// Deudas y cuotas: préstamos, tarjetas, compras en cuotas y lo que te deben.
// Pagar una deuda = transferencia desde una cuenta propia (no es gasto).
import { useState, type ReactNode } from 'react'
import { useRefData } from '@/context/RefData'
import { listPlans, type PlanWithStatus } from '@/data/installments'
import { useQuery } from '@/hooks/useQuery'
import { cardStatus, debtOf, loanStatus } from '@/lib/debt'
import { formatCLP, formatDate } from '@/lib/format'
import { ACCOUNT_TYPES, iconFor } from '@/lib/icons'
import { Modal } from '@/components/Modal'
import { ProgressBar } from '@/components/ProgressBar'
import { Alert, Button, Card, EmptyState, Spinner } from '@/components/ui'
import { AccountForm } from '@/features/accounts/AccountForm'
import { useTransactionDrawer } from '@/features/transactions/TransactionDrawer'
import type { AccountType, AccountWithBalance } from '@/types'
import { InstallmentForm } from './InstallmentForm'

type AccountModal = { account?: AccountWithBalance; type: AccountType } | null

export default function DebtsPage() {
  const { accounts, categoryById, accountById, loading } = useRefData()
  const { openNew } = useTransactionDrawer()
  const plans = useQuery(listPlans, [], ['installments', 'transactions'])
  const [accountModal, setAccountModal] = useState<AccountModal>(null)
  const [planModal, setPlanModal] = useState<PlanWithStatus | 'new' | null>(null)

  if (loading) return <Spinner label="Cargando…" />

  const active = accounts.filter((a) => !a.archived)
  const loans = active.filter((a) => a.type === 'loan')
  const cards = active.filter((a) => a.type === 'credit_card')
  const receivables = active.filter((a) => a.type === 'receivable')
  const owe = [...loans, ...cards].reduce((s, a) => s + debtOf(a), 0)
  const owed = receivables.reduce((s, a) => s + Math.max(0, a.balance), 0)
  const planList = plans.data ?? []
  const activePlans = planList.filter((p) => p.remaining > 0)
  const finishedPlans = planList.filter((p) => p.remaining === 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Deudas y cuotas</h1>
        <Button onClick={() => setAccountModal({ type: 'loan' })}>+ Agregar deuda</Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-sm text-slate-600 dark:text-slate-300">Debes en total</p>
          <p className="text-2xl font-bold text-red-700 dark:text-red-400">{formatCLP(owe)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Préstamos y tarjetas</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-sm text-slate-600 dark:text-slate-300">Te deben</p>
          <p className="text-2xl font-bold text-green-700 dark:text-green-400">{formatCLP(owed)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Préstamos que hiciste</p>
        </div>
      </div>

      <Section title="Préstamos y deudas" empty={loans.length === 0 && (
        <EmptyState icon="🧾" title="Sin préstamos registrados"
          action={<Button variant="secondary" onClick={() => setAccountModal({ type: 'loan' })}>+ Agregar deuda</Button>}>
          Agrega un crédito de consumo, hipotecario o una deuda con alguien para seguir cuánto te falta pagar.
        </EmptyState>
      )}>
        {loans.map((a) => {
          const s = loanStatus(a)
          return (
            <Item key={a.id} icon={ACCOUNT_TYPES.loan.icon} color={a.color} title={a.name}
              subtitle={[a.counterparty, a.interest_rate != null && `${String(a.interest_rate).replace('.', ',')}% anual`].filter(Boolean).join(' · ')}
              amountLabel="Debes" amount={s.debt} amountClass="text-red-700 dark:text-red-400"
              onEdit={() => setAccountModal({ account: a, type: 'loan' })}
              action={s.debt > 0 && (
                <Button className="min-h-9 text-sm" onClick={() => openNew({
                  type: 'transfer', to_account_id: a.id, amount: a.loan_installment ?? undefined, note: `Pago ${a.name}`,
                }, 'Registrar pago')}>Registrar pago</Button>
              )}>
              {s.pct != null && <ProgressBar pct={s.pct} label={`${a.name}: ${s.pct}% pagado`} />}
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {s.pct != null && <>{s.pct}% pagado ({formatCLP(s.paid ?? 0)} de {formatCLP(a.loan_amount ?? 0)}) · </>}
                {a.loan_installment && <>Cuota {formatCLP(a.loan_installment)} · </>}
                {s.installmentsLeft != null && s.installmentsLeft > 0 && <>~{s.installmentsLeft} cuotas restantes · </>}
                {a.payment_day && <>Paga el {a.payment_day}</>}
                {s.debt === 0 && <>🎉 Pagada</>}
              </p>
            </Item>
          )
        })}
      </Section>

      <Section title="Tarjetas de crédito" empty={cards.length === 0 && (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          No tienes tarjetas. <button className="font-medium text-teal-700 underline dark:text-teal-400"
            onClick={() => setAccountModal({ type: 'credit_card' })}>Agregar tarjeta</button>
        </p>
      )}>
        {cards.map((a) => {
          const s = cardStatus(a)
          return (
            <Item key={a.id} icon={ACCOUNT_TYPES.credit_card.icon} color={a.color} title={a.name}
              subtitle={[a.closing_day && `Cierra el ${a.closing_day}`, a.payment_day && `Paga el ${a.payment_day}`].filter(Boolean).join(' · ')}
              amountLabel="Deuda" amount={s.debt} amountClass={s.debt > 0 ? 'text-red-700 dark:text-red-400' : ''}
              onEdit={() => setAccountModal({ account: a, type: 'credit_card' })}
              action={s.debt > 0 && (
                <Button className="min-h-9 text-sm" onClick={() => openNew({
                  type: 'transfer', to_account_id: a.id, amount: s.debt, note: `Pago ${a.name}`,
                }, 'Pagar tarjeta')}>Pagar</Button>
              )}>
              {s.usedPct != null && (
                <>
                  <ProgressBar pct={s.usedPct} label={`${a.name}: ${s.usedPct}% del cupo usado`}
                    barClass={s.usedPct >= 80 ? 'bg-amber-500' : 'bg-teal-600'} />
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {s.usedPct >= 80 && <span aria-hidden>⚠️ </span>}
                    {s.usedPct}% del cupo usado · disponible {formatCLP(s.available ?? 0)}
                  </p>
                </>
              )}
            </Item>
          )
        })}
      </Section>

      <Section title="Compras en cuotas"
        headerAction={cards.length > 0 && <Button variant="secondary" className="min-h-9 text-sm" onClick={() => setPlanModal('new')}>+ Compra en cuotas</Button>}
        empty={!plans.loading && planList.length === 0 && (
          <EmptyState icon="🛍️" title="Sin compras en cuotas"
            action={cards.length > 0
              ? <Button variant="secondary" onClick={() => setPlanModal('new')}>+ Compra en cuotas</Button>
              : <Button variant="secondary" onClick={() => setAccountModal({ type: 'credit_card' })}>Primero agrega tu tarjeta</Button>}>
            Registra una compra en cuotas una sola vez: cada cuota aparecerá en su mes y contará en tus presupuestos.
          </EmptyState>
        )}>
        {plans.error && <Alert>{plans.error}</Alert>}
        {plans.loading && !plans.data && <Spinner />}
        {[...activePlans, ...finishedPlans].map((p) => {
          const cat = p.category_id ? categoryById.get(p.category_id) : undefined
          const pct = (p.paidCount / p.installments_count) * 100
          return (
            <Item key={p.id} icon={iconFor(cat?.icon)} color={cat?.color ?? '#64748b'} title={p.description}
              subtitle={`${accountById.get(p.account_id)?.name ?? 'Tarjeta'} · ${p.installments_count} cuotas de ${formatCLP(p.installment_amount)}`}
              amountLabel={p.remaining > 0 ? 'Te quedan' : 'Total'} amount={p.remaining > 0 ? p.remaining : p.total_amount}
              onEdit={() => setPlanModal(p)}>
              <ProgressBar pct={pct} label={`${p.description}: cuota ${p.paidCount} de ${p.installments_count}`} />
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Cuota {p.paidCount} de {p.installments_count}
                {p.next ? <> · próxima el {formatDate(p.next.date)} por {formatCLP(p.next.amount)}</> : <> · ✓ Pagada</>}
              </p>
            </Item>
          )
        })}
      </Section>

      <Section title="Me deben"
        headerAction={<Button variant="secondary" className="min-h-9 text-sm" onClick={() => setAccountModal({ type: 'receivable' })}>+ Alguien me debe</Button>}
        empty={receivables.length === 0 && (
          <p className="text-sm text-slate-600 dark:text-slate-300">Si le prestaste dinero a alguien, regístralo aquí para no olvidarlo.</p>
        )}>
        {receivables.map((a) => (
          <Item key={a.id} icon={ACCOUNT_TYPES.receivable.icon} color={a.color} title={a.name} subtitle={a.counterparty ?? ''}
            amountLabel="Te deben" amount={Math.max(0, a.balance)} amountClass="text-green-700 dark:text-green-400"
            onEdit={() => setAccountModal({ account: a, type: 'receivable' })}
            action={a.balance > 0 && (
              <Button className="min-h-9 text-sm" onClick={() => openNew({
                type: 'transfer', account_id: a.id, amount: a.balance, note: `Cobro ${a.name}`,
              }, 'Registrar cobro')}>Registrar cobro</Button>
            )} />
        ))}
      </Section>

      <Modal open={accountModal !== null} onClose={() => setAccountModal(null)}
        title={accountModal?.account ? 'Editar' : accountModal?.type === 'receivable' ? 'Alguien me debe' : accountModal?.type === 'credit_card' ? 'Nueva tarjeta' : 'Nueva deuda'}>
        {accountModal && (
          <AccountForm account={accountModal.account} defaultType={accountModal.type} onDone={() => setAccountModal(null)} />
        )}
      </Modal>

      <Modal open={planModal !== null} onClose={() => setPlanModal(null)}
        title={planModal === 'new' ? 'Nueva compra en cuotas' : 'Editar compra en cuotas'}>
        {planModal && <InstallmentForm plan={planModal === 'new' ? undefined : planModal} onDone={() => setPlanModal(null)} />}
      </Modal>
    </div>
  )
}

function Section({ title, children, empty, headerAction }: {
  title: string; children?: ReactNode; empty?: ReactNode; headerAction?: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {headerAction}
      </div>
      {empty || <ul className="grid gap-3 md:grid-cols-2">{children}</ul>}
    </section>
  )
}

function Item({ icon, color, title, subtitle, amountLabel, amount, amountClass = '', onEdit, action, children }: {
  icon: string; color: string; title: string; subtitle: string
  amountLabel: string; amount: number; amountClass?: string
  onEdit: () => void; action?: ReactNode; children?: ReactNode
}) {
  return (
    <li>
      <Card className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full text-lg" style={{ backgroundColor: `${color}26` }} aria-hidden>{icon}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{title}</p>
            {subtitle && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 dark:text-slate-400">{amountLabel}</p>
            <p className={`font-bold tabular-nums ${amountClass}`}>{formatCLP(amount)}</p>
          </div>
        </div>
        {children}
        <div className="mt-auto flex flex-wrap justify-end gap-2">
          <Button variant="secondary" className="min-h-9 text-sm" onClick={onEdit}>Editar</Button>
          {action}
        </div>
      </Card>
    </li>
  )
}
