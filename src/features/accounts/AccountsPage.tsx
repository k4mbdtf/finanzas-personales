import { useState } from 'react'
import { useRefData } from '@/context/RefData'
import { formatCLP } from '@/lib/format'
import { ACCOUNT_TYPES } from '@/lib/icons'
import { cardStatus, loanStatus } from '@/lib/debt'
import { ProgressBar } from '@/components/ProgressBar'
import { Modal } from '@/components/Modal'
import { Alert, Button, EmptyState, Spinner } from '@/components/ui'
import type { AccountWithBalance } from '@/types'
import { AccountForm } from './AccountForm'

export default function AccountsPage() {
  const { accounts, loading, error } = useRefData()
  const [editing, setEditing] = useState<AccountWithBalance | 'new' | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const active = accounts.filter((a) => !a.archived)
  const archived = accounts.filter((a) => a.archived)
  const total = active.reduce((s, a) => s + a.balance, 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Cuentas</h1>
        {active.length > 0 && <Button onClick={() => setEditing('new')}>+ Nueva cuenta</Button>}
      </div>

      {error && <Alert>{error}</Alert>}
      {loading ? (
        <Spinner label="Cargando cuentas…" />
      ) : active.length === 0 && archived.length === 0 ? (
        <EmptyState icon="🏦" title="Crea tu primera cuenta"
          action={<Button onClick={() => setEditing('new')}>+ Nueva cuenta</Button>}>
          Agrega donde tienes tu dinero: efectivo, cuenta bancaria, ahorro o tarjeta de crédito,
          con su saldo actual. Después podrás registrar movimientos en ellas.
        </EmptyState>
      ) : (
        <>
          <div className="rounded-2xl bg-teal-700 p-5 text-white dark:bg-teal-800">
            <p className="text-sm opacity-90">Saldo total</p>
            <p className="text-3xl font-bold">{formatCLP(total)}</p>
            <p className="mt-1 text-xs opacity-80">Lo que tienes menos tus deudas (tarjetas y préstamos restan).</p>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {active.map((a) => <AccountCard key={a.id} account={a} onClick={() => setEditing(a)} />)}
          </ul>

          {archived.length > 0 && (
            <section>
              <button className="text-sm font-medium text-slate-600 underline dark:text-slate-300"
                aria-expanded={showArchived} onClick={() => setShowArchived((v) => !v)}>
                {showArchived ? 'Ocultar' : 'Ver'} cuentas archivadas ({archived.length})
              </button>
              {showArchived && (
                <ul className="mt-3 grid gap-3 opacity-75 sm:grid-cols-2">
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

  return (
    <li>
      <button onClick={onClick}
        className="flex w-full flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full text-lg" style={{ backgroundColor: `${a.color}22` }} aria-hidden>
            {t.icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{a.name}{a.archived && ' (archivada)'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.label}</p>
          </div>
          <span className="size-3 rounded-full" style={{ backgroundColor: a.color }} aria-hidden />
        </div>

        {isCard ? (
          <>
            <p className="tabular-nums">
              <span className="text-sm text-slate-500 dark:text-slate-400">Deuda </span>
              <span className="text-xl font-bold">{formatCLP(debt)}</span>
            </p>
            {usedPct != null && (
              <ProgressBar pct={usedPct} label={`Cupo utilizado: ${usedPct}%`}
                barClass={usedPct >= 80 ? 'bg-amber-500' : 'bg-teal-600'} />
            )}
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {available != null && <>Disponible {formatCLP(available)} de {formatCLP(a.credit_limit!)} · </>}
              {a.closing_day && <>Cierra el {a.closing_day} · </>}
              {a.payment_day && <>Paga el {a.payment_day}</>}
            </p>
          </>
        ) : loan ? (
          <>
            <p className="tabular-nums">
              <span className="text-sm text-slate-500 dark:text-slate-400">Debes </span>
              <span className="text-xl font-bold">{formatCLP(loan.debt)}</span>
            </p>
            {loan.pct != null && <ProgressBar pct={loan.pct} label={`Pagado: ${loan.pct}%`} />}
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {a.counterparty && <>{a.counterparty} · </>}
              {loan.pct != null && <>{loan.pct}% pagado · </>}
              {a.payment_day && <>Paga el {a.payment_day}</>}
            </p>
          </>
        ) : a.type === 'receivable' ? (
          <p className="tabular-nums">
            <span className="text-sm text-slate-500 dark:text-slate-400">Te deben </span>
            <span className="text-xl font-bold">{formatCLP(Math.max(0, a.balance))}</span>
            {a.counterparty && <span className="block text-xs text-slate-600 dark:text-slate-300">{a.counterparty}</span>}
          </p>
        ) : (
          <p className={`text-xl font-bold tabular-nums ${a.balance < 0 ? 'text-red-700 dark:text-red-400' : ''}`}>
            {formatCLP(a.balance)}
          </p>
        )}
      </button>
    </li>
  )
}
