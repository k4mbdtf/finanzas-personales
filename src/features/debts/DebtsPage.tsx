// Deudas y cuotas: préstamos, tarjetas, compras en cuotas y lo que te deben.
// Pagar una deuda = transferencia desde una cuenta propia (no es gasto).
import { useState, type ReactNode } from 'react'
import { CircleCheck, CreditCard, HandCoins, Pencil, Plus, ShoppingBag, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useRefData } from '@/context/RefData'
import { listPlans, type PlanWithStatus } from '@/data/installments'
import { useQuery } from '@/hooks/useQuery'
import { cardStatus, debtOf, loanStatus } from '@/lib/debt'
import { formatCLP, formatDate } from '@/lib/format'
import { useAnimatedNumber } from '@/lib/motion'
import { ACCOUNT_ICONS, IconTile, categoryIcon } from '@/components/icons'
import { Modal } from '@/components/Modal'
import { ProgressBar } from '@/components/ProgressBar'
import { Alert, Button, Card, EmptyState, Loading, PageHeader } from '@/components/ui'
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

  const active = accounts.filter((a) => !a.archived)
  const loans = active.filter((a) => a.type === 'loan')
  const cards = active.filter((a) => a.type === 'credit_card')
  const receivables = active.filter((a) => a.type === 'receivable')
  const owe = [...loans, ...cards].reduce((s, a) => s + debtOf(a), 0)
  const owed = receivables.reduce((s, a) => s + Math.max(0, a.balance), 0)
  const shownOwe = useAnimatedNumber(owe)
  const shownOwed = useAnimatedNumber(owed)

  if (loading) return <Loading label="Cargando…" />

  const planList = plans.data ?? []
  const activePlans = planList.filter((p) => p.remaining > 0)
  const finishedPlans = planList.filter((p) => p.remaining === 0)

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Deudas y cuotas"
        action={<Button icon={Plus} onClick={() => setAccountModal({ type: 'loan' })}>Agregar deuda</Button>} />

      <div className="stagger grid grid-cols-2 gap-3">
        <div className="card flex flex-col gap-2 p-4 md:p-5">
          <p className="label-caps">Debes en total</p>
          <p className="figure-hero text-[1.5rem] leading-tight text-neg sm:text-[1.875rem]">
            <span className="sr-only">{formatCLP(owe)}</span><span aria-hidden>{formatCLP(shownOwe)}</span>
          </p>
          <p className="text-xs text-muted">Préstamos y tarjetas</p>
        </div>
        <div className="card flex flex-col gap-2 p-4 md:p-5">
          <p className="label-caps">Te deben</p>
          <p className="figure-hero text-[1.5rem] leading-tight text-pos sm:text-[1.875rem]">
            <span className="sr-only">{formatCLP(owed)}</span><span aria-hidden>{formatCLP(shownOwed)}</span>
          </p>
          <p className="text-xs text-muted">Préstamos que hiciste</p>
        </div>
      </div>

      <Section title="Préstamos y deudas" empty={loans.length === 0 && (
        <EmptyState icon={HandCoins} title="Sin préstamos registrados"
          action={<Button variant="secondary" icon={Plus} onClick={() => setAccountModal({ type: 'loan' })}>Agregar deuda</Button>}>
          Agrega un crédito de consumo, hipotecario o una deuda con alguien para seguir cuánto te falta pagar.
        </EmptyState>
      )}>
        {loans.map((a) => {
          const s = loanStatus(a)
          return (
            <Item key={a.id} icon={ACCOUNT_ICONS.loan} color={a.color} title={a.name}
              subtitle={[a.counterparty, a.interest_rate != null && `${String(a.interest_rate).replace('.', ',')}% anual`].filter(Boolean).join(' · ')}
              amountLabel="Debes" amount={s.debt} amountClass="text-neg"
              onEdit={() => setAccountModal({ account: a, type: 'loan' })}
              action={s.debt > 0 && (
                <Button size="sm" onClick={() => openNew({
                  type: 'transfer', to_account_id: a.id, amount: a.loan_installment ?? undefined, note: `Pago ${a.name}`,
                }, 'Registrar pago')}>Registrar pago</Button>
              )}>
              {s.pct != null && <ProgressBar pct={s.pct} label={`${a.name}: ${s.pct}% pagado`} barClass="bg-pos-bar" />}
              <p className="text-xs leading-relaxed text-muted">
                {s.pct != null && <>{s.pct}% pagado ({formatCLP(s.paid ?? 0)} de {formatCLP(a.loan_amount ?? 0)}) · </>}
                {a.loan_installment && <>Cuota {formatCLP(a.loan_installment)} · </>}
                {s.installmentsLeft != null && s.installmentsLeft > 0 && <>~{s.installmentsLeft} cuotas restantes · </>}
                {a.payment_day && <>Paga el {a.payment_day}</>}
              </p>
              {s.debt === 0 && <Done>Pagada</Done>}
            </Item>
          )
        })}
      </Section>

      <Section title="Tarjetas de crédito" empty={cards.length === 0 && (
        <p className="text-sm text-soft">
          No tienes tarjetas. <button className="link" onClick={() => setAccountModal({ type: 'credit_card' })}>Agregar tarjeta</button>
        </p>
      )}>
        {cards.map((a) => {
          const s = cardStatus(a)
          return (
            <Item key={a.id} icon={ACCOUNT_ICONS.credit_card} color={a.color} title={a.name}
              subtitle={[a.closing_day && `Cierra el ${a.closing_day}`, a.payment_day && `Paga el ${a.payment_day}`].filter(Boolean).join(' · ')}
              amountLabel="Deuda" amount={s.debt} amountClass={s.debt > 0 ? 'text-neg' : ''}
              onEdit={() => setAccountModal({ account: a, type: 'credit_card' })}
              action={s.debt > 0 && (
                <Button size="sm" onClick={() => openNew({
                  type: 'transfer', to_account_id: a.id, amount: s.debt, note: `Pago ${a.name}`,
                }, 'Pagar tarjeta')}>Pagar</Button>
              )}>
              {s.usedPct != null && (
                <>
                  <ProgressBar pct={s.usedPct} label={`${a.name}: ${s.usedPct}% del cupo usado`}
                    barClass={s.usedPct >= 80 ? 'bg-warn-bar' : 'bg-ink'} />
                  <p className={`flex items-center gap-1.5 text-xs ${s.usedPct >= 80 ? 'font-medium text-warn' : 'text-muted'}`}>
                    {s.usedPct >= 80 && <TriangleAlert size={14} strokeWidth={2.25} aria-hidden />}
                    {s.usedPct}% del cupo usado · disponible {formatCLP(s.available ?? 0)}
                  </p>
                </>
              )}
            </Item>
          )
        })}
      </Section>

      <Section title="Compras en cuotas"
        headerAction={cards.length > 0 && <Button variant="secondary" size="sm" icon={Plus} onClick={() => setPlanModal('new')}>Compra en cuotas</Button>}
        empty={!plans.loading && planList.length === 0 && (
          <EmptyState icon={ShoppingBag} title="Sin compras en cuotas"
            action={cards.length > 0
              ? <Button variant="secondary" icon={Plus} onClick={() => setPlanModal('new')}>Compra en cuotas</Button>
              : <Button variant="secondary" icon={CreditCard} onClick={() => setAccountModal({ type: 'credit_card' })}>Primero agrega tu tarjeta</Button>}>
            Registra una compra en cuotas una sola vez: cada cuota aparecerá en su mes y contará en tus presupuestos.
          </EmptyState>
        )}>
        {plans.error && <Alert>{plans.error}</Alert>}
        {plans.loading && !plans.data && <Loading />}
        {[...activePlans, ...finishedPlans].map((p) => {
          const cat = p.category_id ? categoryById.get(p.category_id) : undefined
          const pct = (p.paidCount / p.installments_count) * 100
          return (
            <Item key={p.id} icon={categoryIcon(cat?.icon)} color={cat?.color} title={p.description}
              subtitle={`${accountById.get(p.account_id)?.name ?? 'Tarjeta'} · ${p.installments_count} cuotas de ${formatCLP(p.installment_amount)}`}
              amountLabel={p.remaining > 0 ? 'Te quedan' : 'Total'} amount={p.remaining > 0 ? p.remaining : p.total_amount}
              onEdit={() => setPlanModal(p)}>
              <ProgressBar pct={pct} label={`${p.description}: cuota ${p.paidCount} de ${p.installments_count}`} />
              {p.next
                ? <p className="text-xs text-muted">Cuota {p.paidCount} de {p.installments_count} · próxima el {formatDate(p.next.date)} por {formatCLP(p.next.amount)}</p>
                : <Done>Pagada · {p.installments_count} cuotas</Done>}
            </Item>
          )
        })}
      </Section>

      <Section title="Me deben"
        headerAction={<Button variant="secondary" size="sm" icon={Plus} onClick={() => setAccountModal({ type: 'receivable' })}>Alguien me debe</Button>}
        empty={receivables.length === 0 && (
          <p className="text-sm text-soft">Si le prestaste dinero a alguien, regístralo aquí para no olvidarlo.</p>
        )}>
        {receivables.map((a) => (
          <Item key={a.id} icon={ACCOUNT_ICONS.receivable} color={a.color} title={a.name} subtitle={a.counterparty ?? ''}
            amountLabel="Te deben" amount={Math.max(0, a.balance)} amountClass="text-pos"
            onEdit={() => setAccountModal({ account: a, type: 'receivable' })}
            action={a.balance > 0 && (
              <Button size="sm" onClick={() => openNew({
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

function Done({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-xs font-medium text-pos">
      <CircleCheck size={14} strokeWidth={2.25} aria-hidden />{children}
    </p>
  )
}

function Section({ title, children, empty, headerAction }: {
  title: string; children?: ReactNode; empty?: ReactNode; headerAction?: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex min-h-9 items-center justify-between gap-2">
        <h2 className="text-[1.0625rem] font-semibold tracking-tight">{title}</h2>
        {headerAction}
      </div>
      {empty || <ul className="stagger grid gap-3 md:grid-cols-2">{children}</ul>}
    </section>
  )
}

function Item({ icon, color, title, subtitle, amountLabel, amount, amountClass = '', onEdit, action, children }: {
  icon: LucideIcon; color?: string; title: string; subtitle: string
  amountLabel: string; amount: number; amountClass?: string
  onEdit: () => void; action?: ReactNode; children?: ReactNode
}) {
  return (
    <li>
      <Card pad="sm" className="flex h-full flex-col gap-3 md:p-5">
        <div className="flex items-start gap-3">
          <IconTile icon={icon} color={color} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{title}</p>
            {subtitle && <p className="truncate text-[0.8125rem] text-muted">{subtitle}</p>}
          </div>
          <div className="text-right">
            <p className="label-caps">{amountLabel}</p>
            <p className={`text-[1.0625rem] font-bold tracking-tight tabular-nums ${amountClass}`}>{formatCLP(amount)}</p>
          </div>
        </div>
        {children}
        <div className="mt-auto flex flex-wrap justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" icon={Pencil} onClick={onEdit}>Editar</Button>
          {action}
        </div>
      </Card>
    </li>
  )
}
