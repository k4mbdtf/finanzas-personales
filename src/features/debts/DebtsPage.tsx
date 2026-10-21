// Deudas y cuotas: lo que debes (préstamos y deudas), tarjetas, compras en
// cuotas y lo que te deben. Las deudas NO son cuentas: no aparecen en Cuentas
// ni en los formularios de gastos. Pagar = transferencia desde una cuenta (no es gasto).
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Archive, ChevronDown, ChevronRight, CreditCard, HandCoins, Pencil, Plus, ShoppingBag, TriangleAlert, type LucideIcon,
} from 'lucide-react'
import { useRefData } from '@/context/RefData'
import { updateAccount } from '@/data/accounts'
import { listPlans, type PlanWithStatus } from '@/data/installments'
import { useQuery } from '@/hooks/useQuery'
import { useMoney } from '@/hooks/useMoney'
import { currencyOf, formatMoney, nativeBalance, nativeView, type Currency } from '@/lib/currency'
import { cardStatus, debtOf, loanStatus, receivableStatus } from '@/lib/debt'
import { formatCLP, formatDate } from '@/lib/format'
import { useAnimatedNumber } from '@/lib/motion'
import { AccountIcon, IconTile, categoryIcon } from '@/components/icons'
import { useToast } from '@/components/Feedback'
import { Modal } from '@/components/Modal'
import { ProgressBar } from '@/components/ProgressBar'
import { Alert, Button, Card, EmptyState, Loading, PageHeader } from '@/components/ui'
import { AccountForm } from '@/features/accounts/AccountForm'
import { useTransactionDrawer } from '@/features/transactions/TransactionDrawer'
import type { AccountWithBalance } from '@/types'
import { DebtForm, type DebtKind } from './DebtForm'
import { Done, loanDetails, useDebtActions } from './debtShared'
import { InstallmentForm } from './InstallmentForm'

type DebtModal = { debt?: AccountWithBalance; kind: DebtKind } | null
type CardModal = AccountWithBalance | 'new' | null

export default function DebtsPage() {
  const { accounts, debts, categoryById, accountById, loading } = useRefData()
  const { openNew } = useTransactionDrawer()
  const actions = useDebtActions()
  const toast = useToast()
  const money = useMoney()
  const plans = useQuery(listPlans, [], ['installments', 'transactions'])
  const [debtModal, setDebtModal] = useState<DebtModal>(null)
  const [cardModal, setCardModal] = useState<CardModal>(null)
  const [planModal, setPlanModal] = useState<PlanWithStatus | 'new' | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const loans = debts.filter((a) => a.type === 'loan' && !a.archived)
  const receivables = debts.filter((a) => a.type === 'receivable' && !a.archived)
  const archived = debts.filter((a) => a.archived)
  const cards = accounts.filter((a) => a.type === 'credit_card' && !a.archived)
  // Tarjetas en UF/USD: su deuda en pesos de hoy.
  const owe = [...loans, ...cards].reduce((s, a) => s + debtOf({ balance: money.clp(a) }), 0)
  const owed = receivables.reduce((s, a) => s + Math.max(0, money.clp(a)), 0)
  const shownOwe = useAnimatedNumber(owe)
  const shownOwed = useAnimatedNumber(owed)

  if (loading) return <Loading label="Cargando…" />

  const planList = plans.data ?? []
  const activePlans = planList.filter((p) => p.remaining > 0)
  const finishedPlans = planList.filter((p) => p.remaining === 0)

  async function archive(a: AccountWithBalance) {
    try {
      await updateAccount(a.id, { archived: true })
      toast(`${a.name} archivada`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo archivar.', 'error')
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Deudas y cuotas"
        action={<Button icon={Plus} onClick={() => setDebtModal({ kind: 'loan' })}>Nueva deuda</Button>} />

      <div className="stagger grid grid-cols-2 gap-3">
        <div className="card flex flex-col gap-2 p-4 md:p-5">
          <p className="label-caps">Debes en total</p>
          <p className="figure-hero text-[1.5rem] leading-tight text-neg sm:text-[1.875rem]">
            <span className="sr-only">{formatCLP(owe)}</span><span aria-hidden>{formatCLP(shownOwe)}</span>
          </p>
          <p className="text-xs text-muted">Deudas y tarjetas</p>
        </div>
        <div className="card flex flex-col gap-2 p-4 md:p-5">
          <p className="label-caps">Te deben</p>
          <p className="figure-hero text-[1.5rem] leading-tight text-pos sm:text-[1.875rem]">
            <span className="sr-only">{formatCLP(owed)}</span><span aria-hidden>{formatCLP(shownOwed)}</span>
          </p>
          <p className="text-xs text-muted">Préstamos que hiciste</p>
        </div>
      </div>

      <Section title="Lo que debes" empty={loans.length === 0 && (
        <EmptyState icon={HandCoins} title="Sin deudas registradas"
          action={<Button variant="secondary" icon={Plus} onClick={() => setDebtModal({ kind: 'loan' })}>Agregar deuda</Button>}>
          Anota un crédito de consumo, un hipotecario o lo que le debes a alguien. Verás cuánto te falta y en qué cuota vas;
          no aparecerá en tus cuentas.
        </EmptyState>
      )}>
        {loans.map((a) => {
          const s = loanStatus(nativeView(a, money.rates))
          return (
            <Item key={a.id} account={a}
              subtitle={[a.counterparty, a.interest_rate != null && `${String(a.interest_rate).replace('.', ',')}% anual`].filter(Boolean).join(' · ')}
              amountLabel="Debes" amount={s.debt} currency={currencyOf(a)} amountClass={s.debt > 0 ? 'text-neg' : ''}
              action={s.debt > 0
                ? <Button size="sm" onClick={() => actions.pay(a)}>Pagar</Button>
                : <Button size="sm" variant="secondary" icon={Archive} onClick={() => archive(a)}>Archivar</Button>}>
              {s.pct != null && <ProgressBar pct={s.pct} label={`${a.name}: ${s.pct}% pagado`} barClass="bg-pos-bar" />}
              {s.debt === 0 ? <Done>Pagada</Done> : <p className="text-xs leading-relaxed text-muted">{loanDetails(a, money.rates) || 'Aún no registras pagos'}</p>}
            </Item>
          )
        })}
      </Section>

      <Section title="Tarjetas de crédito" empty={cards.length === 0 && (
        <p className="text-sm text-soft">
          No tienes tarjetas. <button className="link" onClick={() => setCardModal('new')}>Agregar tarjeta</button>
        </p>
      )}>
        {cards.map((a) => {
          const cur = currencyOf(a)
          const s = cardStatus({ balance: nativeBalance(a), credit_limit: a.credit_limit })
          return (
            <Item key={a.id} account={a}
              subtitle={[a.closing_day && `Cierra el ${a.closing_day}`, a.payment_day && `Paga el ${a.payment_day}`].filter(Boolean).join(' · ')}
              amountLabel="Deuda" amount={s.debt} currency={cur} amountClass={s.debt > 0 ? 'text-neg' : ''}
              onEdit={() => setCardModal(a)}
              action={s.debt > 0 && (
                <Button size="sm" onClick={() => openNew({
                  type: 'transfer', to_account_id: a.id, note: `Pago ${a.name}`,
                  // Tarjeta en UF/USD: se precompleta cuánto llega en su moneda.
                  ...(cur === 'CLP' ? { amount: s.debt } : { to_amount_native: s.debt }),
                }, 'Pagar tarjeta')}>Pagar</Button>
              )}>
              {s.usedPct != null && (
                <>
                  <ProgressBar pct={s.usedPct} label={`${a.name}: ${s.usedPct}% del cupo usado`}
                    barClass={s.usedPct >= 80 ? 'bg-warn-bar' : 'bg-ink'} />
                  <p className={`flex items-center gap-1.5 text-xs ${s.usedPct >= 80 ? 'font-medium text-warn' : 'text-muted'}`}>
                    {s.usedPct >= 80 && <TriangleAlert size={14} strokeWidth={2.25} aria-hidden />}
                    {s.usedPct}% del cupo usado · disponible {formatMoney(s.available ?? 0, cur)}
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
              : <Button variant="secondary" icon={CreditCard} onClick={() => setCardModal('new')}>Primero agrega tu tarjeta</Button>}>
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

      <Section title="Lo que te deben"
        headerAction={<Button variant="secondary" size="sm" icon={Plus} onClick={() => setDebtModal({ kind: 'receivable' })}>Alguien me debe</Button>}
        empty={receivables.length === 0 && (
          <p className="text-sm text-soft">Si le prestaste dinero a alguien, anótalo aquí para no olvidarlo.</p>
        )}>
        {receivables.map((a) => {
          const cur = currencyOf(a)
          const s = receivableStatus(nativeView(a, money.rates))
          return (
            <Item key={a.id} account={a} subtitle={a.counterparty ?? ''}
              amountLabel="Te deben" amount={s.owed} currency={cur} amountClass={s.owed > 0 ? 'text-pos' : ''}
              action={s.owed > 0
                ? <>
                  <Button size="sm" variant="secondary" onClick={() => actions.lendMore(a)}>Prestar más</Button>
                  <Button size="sm" onClick={() => actions.collect(a)}>Cobrar</Button>
                </>
                : <Button size="sm" variant="secondary" icon={Archive} onClick={() => archive(a)}>Archivar</Button>}>
              {s.collected > 0 && s.pct != null && (
                <ProgressBar pct={s.pct} label={`${a.name}: ${s.pct}% devuelto`} barClass="bg-pos-bar" />
              )}
              {s.owed === 0
                ? <Done>Te pagaron todo</Done>
                : s.collected > 0 && <p className="text-xs text-muted">Te han devuelto {formatMoney(s.collected, cur)} de {formatMoney(s.collected + s.owed, cur)}</p>}
            </Item>
          )
        })}
      </Section>

      {archived.length > 0 && (
        <section>
          <button className="pressable inline-flex items-center gap-1.5 text-sm font-medium text-soft hover:text-ink"
            aria-expanded={showArchived} onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? 'Ocultar' : 'Ver'} archivadas ({archived.length})
            <ChevronDown size={16} strokeWidth={2} aria-hidden
              className={`transition-transform duration-300 ease-soft ${showArchived ? 'rotate-180' : ''}`} />
          </button>
          {showArchived && (
            <ul className="stagger mt-3 card overflow-hidden">
              {archived.map((a) => (
                <li key={a.id} className="border-b border-line last:border-0">
                  <Link to={`/deudas/${a.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-subtle/60">
                    <AccountIcon account={a} size="sm" />
                    <span className="min-w-0 flex-1 truncate font-medium">{a.name}</span>
                    <span className="text-xs text-muted">{a.type === 'loan' ? 'Deuda' : 'Me debían'}</span>
                    <ChevronRight size={18} strokeWidth={2} className="text-muted" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <Modal open={debtModal !== null} onClose={() => setDebtModal(null)}
        title={debtModal?.debt ? 'Editar' : debtModal?.kind === 'receivable' ? 'Alguien me debe' : 'Nueva deuda'}>
        {debtModal && <DebtForm debt={debtModal.debt} defaultKind={debtModal.kind} onDone={() => setDebtModal(null)} />}
      </Modal>

      <Modal open={cardModal !== null} onClose={() => setCardModal(null)} title={cardModal === 'new' ? 'Nueva tarjeta' : 'Editar tarjeta'}>
        {cardModal && (
          <AccountForm account={cardModal === 'new' ? undefined : cardModal} defaultType="credit_card" onDone={() => setCardModal(null)} />
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
      <div className="flex min-h-9 items-center justify-between gap-2">
        <h2 className="text-[1.0625rem] font-semibold tracking-tight">{title}</h2>
        {headerAction}
      </div>
      {empty || <ul className="stagger grid grid-cols-1 gap-3 md:grid-cols-2">{children}</ul>}
    </section>
  )
}

/**
 * Tarjeta de la lista. Con `account` de deuda o "me deben", el título lleva a
 * su detalle; con onEdit (tarjetas y cuotas) se edita en el momento.
 */
function Item({ account, icon, color, title, subtitle, amountLabel, amount, currency = 'CLP', amountClass = '', onEdit, action, children }: {
  account?: AccountWithBalance; icon?: LucideIcon; color?: string; title?: string; subtitle: string
  amountLabel: string; amount: number; currency?: Currency; amountClass?: string
  onEdit?: () => void; action?: ReactNode; children?: ReactNode
}) {
  const detail = account && (account.type === 'loan' || account.type === 'receivable') ? `/deudas/${account.id}` : null
  const name = title ?? account?.name ?? ''
  const head = (
    <>
      {account ? <AccountIcon account={account} /> : <IconTile icon={icon ?? HandCoins} color={color} />}
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{name}</p>
        {subtitle && <p className="truncate text-[0.8125rem] text-muted">{subtitle}</p>}
      </div>
      {detail && <ChevronRight size={18} strokeWidth={2} className="mt-2.5 shrink-0 text-muted" aria-hidden />}
    </>
  )
  return (
    <li className="min-w-0">
      <Card pad="sm" className="flex h-full flex-col gap-3 md:p-5">
        {detail
          ? <Link to={detail} className="-m-1 flex items-start gap-3 rounded-sm p-1 transition-colors duration-200 hover:bg-subtle/50">{head}</Link>
          : <div className="flex items-start gap-3">{head}</div>}
        {/* El monto en su propia fila: el nombre no se corta en el celular. */}
        <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
          <div>
            <p className="label-caps">{amountLabel}</p>
            <p className={`text-[1.375rem] leading-tight font-bold tracking-[-0.02em] tabular-nums ${amountClass}`}>{formatMoney(amount, currency)}</p>
          </div>
          {(action || onEdit) && (
            <div className="flex flex-wrap justify-end gap-2">
              {onEdit && <Button variant="ghost" size="sm" icon={Pencil} onClick={onEdit}>Editar</Button>}
              {action}
            </div>
          )}
        </div>
        {children}
      </Card>
    </li>
  )
}
