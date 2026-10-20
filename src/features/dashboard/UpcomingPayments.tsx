// Próximos pagos (30 días): tarjetas y préstamos según su día de pago, recurrentes de
// gasto o transferencia y cuotas de compras en cuotas. Tocar una tarjeta o un préstamo
// abre el registro del pago ya completado.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, CreditCard, HandCoins, Repeat, ShoppingBag, type LucideIcon } from 'lucide-react'
import { useRefData } from '@/context/RefData'
import { listPlans } from '@/data/installments'
import { listRules } from '@/data/recurring'
import { useQuery } from '@/hooks/useQuery'
import { formatCLP, formatDate, todayISO } from '@/lib/format'
import { dueLabel, upcomingPayments, type Upcoming, type UpcomingKind } from '@/lib/upcoming'
import { IconTile } from '@/components/icons'
import { Card, SectionHeader } from '@/components/ui'
import { useDebtActions } from '@/features/debts/debtShared'
import { useTransactionDrawer } from '@/features/transactions/TransactionDrawer'

const DAYS = 30
const SHOWN = 5

const ICONS: Record<UpcomingKind, LucideIcon> = {
  card: CreditCard, loan: HandCoins, recurring: Repeat, installment: ShoppingBag,
}

export function UpcomingPayments() {
  const { accounts, debts, accountById, categoryById } = useRefData()
  const { openNew } = useTransactionDrawer()
  const { pay } = useDebtActions()
  const [all, setAll] = useState(false)
  const q = useQuery(() => Promise.all([listRules(), listPlans()]), [], ['recurring', 'installments', 'transactions'])

  if (!q.data) return null
  const [rules, plans] = q.data
  const today = todayISO()
  const items = upcomingPayments({
    today, days: DAYS, accounts: [...accounts, ...debts], rules, plans,
    ruleTitle: (r) => {
      const rule = rules.find((x) => x.id === r.id)
      const cat = rule?.category_id ? categoryById.get(rule.category_id)?.name : undefined
      const to = rule?.to_account_id ? accountById.get(rule.to_account_id)?.name : undefined
      return r.note || cat || (to ? `Transferir a ${to}` : 'Movimiento recurrente')
    },
  })
  if (items.length === 0) return null

  const total = items.reduce((s, u) => s + (u.inTotal ? u.amount ?? 0 : 0), 0)
  const shown = all ? items : items.slice(0, SHOWN)

  function act(u: Upcoming) {
    const a = u.accountId ? accountById.get(u.accountId) : undefined
    if (!a) return
    if (u.kind === 'loan') pay(a)
    else openNew({ type: 'transfer', to_account_id: a.id, amount: u.amount ?? undefined, note: `Pago ${a.name}` }, 'Pagar tarjeta')
  }

  return (
    <section aria-labelledby="proximos-pagos">
      <SectionHeader id="proximos-pagos" title="Próximos pagos" icon={CalendarClock}
        action={<span className="text-muted">{DAYS} días · <span className="font-semibold text-ink tabular-nums">{formatCLP(total)}</span></span>} />
      <Card pad="none">
        <ul className="stagger">
          {shown.map((u) => {
            const body = (
              <>
                <IconTile icon={ICONS[u.kind]} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{u.title}</span>
                  <span className="block truncate text-[0.8125rem] text-muted">{u.detail}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[0.9375rem] font-semibold tabular-nums">{u.amount != null ? formatCLP(u.amount) : '—'}</span>
                  <span className={`block text-xs ${u.date === today ? 'font-semibold text-warn' : 'text-muted'}`}>
                    {dueLabel(today, u.date)} · {formatDate(u.date).replace(/ \d{4}$/, '')}
                  </span>
                </span>
              </>
            )
            const cls = 'flex w-full items-center gap-3.5 px-4 py-3 text-left transition-colors duration-200 hover:bg-subtle/60 active:bg-subtle'
            return (
              <li key={`${u.kind}-${u.accountId ?? u.ruleId ?? u.title}-${u.date}`} className="border-b border-line last:border-0">
                {u.kind === 'card' || u.kind === 'loan'
                  ? <button type="button" onClick={() => act(u)} className={cls} aria-label={`${u.title}: registrar el pago`}>{body}</button>
                  : <Link to={u.kind === 'recurring' ? '/recurrentes' : '/deudas'} className={cls}>{body}</Link>}
              </li>
            )
          })}
        </ul>
        {items.length > SHOWN && (
          <button type="button" onClick={() => setAll((v) => !v)}
            className="w-full border-t border-line px-4 py-2.5 text-sm font-semibold text-soft hover:bg-subtle/60 hover:text-ink">
            {all ? 'Ver menos' : `Ver ${items.length - SHOWN} más`}
          </button>
        )}
      </Card>
      {items.some((u) => !u.inTotal) && (
        <p className="mt-2 px-1 text-xs text-muted">Las cuotas se cargan a la tarjeta: no se suman al total.</p>
      )}
    </section>
  )
}
