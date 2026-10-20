import { useState } from 'react'
import { ChevronDown, Plus, Wallet } from 'lucide-react'
import { useRefData } from '@/context/RefData'
import { formatCLP } from '@/lib/format'
import { ACCOUNT_TYPES } from '@/lib/icons'
import { cardStatus, loanStatus } from '@/lib/debt'
import { useAnimatedNumber } from '@/lib/motion'
import { ACCOUNT_ICONS, IconTile } from '@/components/icons'
import { ProgressBar } from '@/components/ProgressBar'
import { Modal } from '@/components/Modal'
import { Alert, Button, EmptyState, Loading, PageHeader } from '@/components/ui'
import type { AccountWithBalance } from '@/types'
import { AccountForm } from './AccountForm'

export default function AccountsPage() {
  const { accounts, loading, error } = useRefData()
  const [editing, setEditing] = useState<AccountWithBalance | 'new' | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const active = accounts.filter((a) => !a.archived)
  const archived = accounts.filter((a) => a.archived)
  const total = active.reduce((s, a) => s + a.balance, 0)
  const shownTotal = useAnimatedNumber(total)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Cuentas"
        action={active.length > 0 && <Button icon={Plus} onClick={() => setEditing('new')}>Nueva cuenta</Button>} />

      {error && <Alert>{error}</Alert>}
      {loading ? (
        <Loading label="Cargando cuentas…" />
      ) : active.length === 0 && archived.length === 0 ? (
        <EmptyState icon={Wallet} title="Crea tu primera cuenta"
          action={<Button icon={Plus} onClick={() => setEditing('new')}>Nueva cuenta</Button>}>
          Agrega donde tienes tu dinero: efectivo, cuenta bancaria, ahorro o tarjeta de crédito,
          con su saldo actual. Después podrás registrar movimientos en ellas.
        </EmptyState>
      ) : (
        <>
          {/* Panel carbón: el único bloque oscuro, para jerarquía clara. */}
          <div className="animate-enter rounded-lg bg-accent p-6 text-on-accent shadow-[var(--shadow-float)] md:p-8">
            <p className="text-xs font-medium tracking-[0.08em] uppercase opacity-75">Saldo total</p>
            <p className="figure-hero mt-2 text-[2.25rem] leading-none md:text-[3rem]">
              <span className="sr-only">{formatCLP(total)}</span><span aria-hidden>{formatCLP(shownTotal)}</span>
            </p>
            <p className="mt-3 text-sm opacity-75">Lo que tienes menos tus deudas (tarjetas y préstamos restan).</p>
          </div>

          <ul className="stagger grid gap-3 sm:grid-cols-2">
            {active.map((a) => <AccountCard key={a.id} account={a} onClick={() => setEditing(a)} />)}
          </ul>

          {archived.length > 0 && (
            <section>
              <button className="pressable inline-flex items-center gap-1.5 text-sm font-medium text-soft hover:text-ink"
                aria-expanded={showArchived} onClick={() => setShowArchived((v) => !v)}>
                {showArchived ? 'Ocultar' : 'Ver'} cuentas archivadas ({archived.length})
                <ChevronDown size={16} strokeWidth={2} aria-hidden
                  className={`transition-transform duration-300 ease-soft ${showArchived ? 'rotate-180' : ''}`} />
              </button>
              {showArchived && (
                <ul className="stagger mt-3 grid gap-3 opacity-75 sm:grid-cols-2">
                  {archived.map((a) => <AccountCard key={a.id} account={a} onClick={() => setEditing(a)} />)}
                </ul>
              )}
            </section>
          )}
        </>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Nueva cuenta' : 'Editar cuenta'}>
        <AccountForm account={editing === 'new' || editing === null ? undefined : editing} onDone={() => setEditing(null)} />
      </Modal>
    </div>
  )
}

function AccountCard({ account: a, onClick }: { account: AccountWithBalance; onClick: () => void }) {
  const t = ACCOUNT_TYPES[a.type]
  const isCard = a.type === 'credit_card'
  const { debt, available, usedPct } = cardStatus(a)
  const loan = a.type === 'loan' ? loanStatus(a) : null
  const amountCls = 'figure-hero text-[1.375rem] leading-tight'

  return (
    <li>
      <button onClick={onClick}
        className="card flex h-full w-full flex-col gap-3 p-4 text-left transition-[border-color,transform] duration-200 hover:border-line-strong/40 active:scale-[0.99] md:p-5">
        <div className="flex items-center gap-3">
          <IconTile icon={ACCOUNT_ICONS[a.type]} color={a.color} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{a.name}{a.archived && ' (archivada)'}</p>
            <p className="text-[0.8125rem] text-muted">{t.label}</p>
          </div>
        </div>

        {isCard ? (
          <>
            <div>
              <p className="label-caps">Deuda</p>
              <p className={amountCls}>{formatCLP(debt)}</p>
            </div>
            {usedPct != null && (
              <ProgressBar pct={usedPct} label={`Cupo utilizado: ${usedPct}%`}
                barClass={usedPct >= 80 ? 'bg-warn-bar' : 'bg-ink'} />
            )}
            <p className="text-xs text-muted">
              {available != null && <>Disponible {formatCLP(available)} de {formatCLP(a.credit_limit!)} · </>}
              {a.closing_day && <>Cierra el {a.closing_day} · </>}
              {a.payment_day && <>Paga el {a.payment_day}</>}
            </p>
          </>
        ) : loan ? (
          <>
            <div>
              <p className="label-caps">Debes</p>
              <p className={amountCls}>{formatCLP(loan.debt)}</p>
            </div>
            {loan.pct != null && <ProgressBar pct={loan.pct} label={`Pagado: ${loan.pct}%`} barClass="bg-pos-bar" />}
            <p className="text-xs text-muted">
              {a.counterparty && <>{a.counterparty} · </>}
              {loan.pct != null && <>{loan.pct}% pagado · </>}
              {a.payment_day && <>Paga el {a.payment_day}</>}
            </p>
          </>
        ) : a.type === 'receivable' ? (
          <div>
            <p className="label-caps">Te deben</p>
            <p className={amountCls}>{formatCLP(Math.max(0, a.balance))}</p>
            {a.counterparty && <p className="mt-1 text-xs text-muted">{a.counterparty}</p>}
          </div>
        ) : (
          <div>
            <p className="label-caps">Saldo</p>
            <p className={`${amountCls} ${a.balance < 0 ? 'text-neg' : ''}`}>{formatCLP(a.balance)}</p>
          </div>
        )}
      </button>
    </li>
  )
}
