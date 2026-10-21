// Cuentas: solo donde está tu dinero (efectivo, bancos, ahorro y tarjetas).
// Las deudas y las inversiones tienen su propia sección; aquí solo se enlazan.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, HandCoins, Plus, TrendingUp, Wallet, type LucideIcon } from 'lucide-react'
import { useRefData } from '@/context/RefData'
import { listInvestmentStatus } from '@/data/investments'
import { useQuery } from '@/hooks/useQuery'
import { useMoney } from '@/hooks/useMoney'
import { CURRENCIES, currencyOf, formatMoney, nativeBalance, rateLabel, type Currency } from '@/lib/currency'
import { formatCLP } from '@/lib/format'
import { ACCOUNT_TYPES } from '@/lib/icons'
import { cardStatus, debtOf } from '@/lib/debt'
import { institutionById, normalizeName } from '@/lib/institutions'
import { useAnimatedNumber } from '@/lib/motion'
import { AccountIcon, IconTile } from '@/components/icons'
import { ProgressBar } from '@/components/ProgressBar'
import { Modal } from '@/components/Modal'
import { Alert, Button, EmptyState, Loading, PageHeader, Segmented } from '@/components/ui'
import type { AccountWithBalance } from '@/types'
import { AccountForm } from './AccountForm'

export default function AccountsPage() {
  const { accounts, debts, investments, loading, error, setViewCurrency } = useRefData()
  const money = useMoney()
  const status = useQuery(listInvestmentStatus, [], ['accounts', 'transactions', 'investments'])
  const [editing, setEditing] = useState<AccountWithBalance | 'new' | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const active = accounts.filter((a) => !a.archived)
  const archived = accounts.filter((a) => a.archived)
  // En pesos de hoy: las cuentas en UF/USD se convierten con el valor del día.
  const total = active.reduce((s, a) => s + money.clp(a), 0)
  const shownTotal = useAnimatedNumber(total)
  const totalInView = money.viewCurrency === 'CLP' ? null : money.view(total)
  const activeDebts = debts.filter((a) => !a.archived)
  const owe = activeDebts.filter((a) => a.type === 'loan').reduce((s, a) => s + debtOf(a), 0)
  const owed = activeDebts.filter((a) => a.type === 'receivable').reduce((s, a) => s + Math.max(0, a.balance), 0)
  const activeInvestments = investments.filter((a) => !a.archived)
  const invested = activeInvestments.reduce((s, a) => s + (status.data?.get(a.id)?.current_value ?? a.balance), 0)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Cuentas"
        action={active.length > 0 && <Button icon={Plus} onClick={() => setEditing('new')}>Nueva cuenta</Button>} />

      {money.multiCurrency && active.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="w-full max-w-xs">
            <Segmented<Currency> label="Ver saldos en" value={money.viewCurrency} onChange={setViewCurrency}
              options={(Object.keys(CURRENCIES) as Currency[]).map((c) => ({ value: c, label: CURRENCIES[c].label }))} />
          </div>
          <p className="text-xs text-muted">
            {(['UF', 'USD'] as const).map((c) => money.rates[c] && rateLabel(c, money.rates[c]!)).filter(Boolean).join(' · ')
              || 'Sin el valor de hoy de la UF y el dólar: se muestra en pesos.'}
          </p>
        </div>
      )}

      {error && <Alert>{error}</Alert>}
      {loading ? (
        <Loading label="Cargando cuentas…" />
      ) : active.length === 0 && archived.length === 0 ? (
        <EmptyState icon={Wallet} title="Crea tu primera cuenta"
          action={<Button icon={Plus} onClick={() => setEditing('new')}>Nueva cuenta</Button>}>
          Agrega donde tienes tu dinero: efectivo, tu CuentaRUT, cuenta corriente, ahorro o tarjeta de crédito,
          con su saldo actual. Elige tu banco y se pone su logo y color.
        </EmptyState>
      ) : (
        <>
          {/* Panel carbón: el único bloque oscuro, para jerarquía clara. */}
          <div className="animate-enter rounded-lg bg-accent p-6 text-on-accent shadow-[var(--shadow-float)] md:p-8">
            <p className="text-xs font-medium tracking-[0.08em] uppercase opacity-75">Saldo total</p>
            <p className="figure-hero mt-2 text-[2.25rem] leading-none md:text-[3rem]">
              <span className="sr-only">{totalInView ?? formatCLP(total)}</span><span aria-hidden>{totalInView ?? formatCLP(shownTotal)}</span>
            </p>
            <p className="mt-3 text-sm opacity-75">Lo que tienes en tus cuentas; lo usado en tarjetas resta.</p>
          </div>

          <ul className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2">
            {active.map((a) => <AccountCard key={a.id} account={a} onClick={() => setEditing(a)} />)}
          </ul>

          {(activeDebts.length > 0 || activeInvestments.length > 0) && (
            <ul className="card overflow-hidden">
              {activeDebts.length > 0 && (
                <ElsewhereRow to="/deudas" icon={HandCoins} title="Deudas y préstamos"
                  detail={[owe > 0 && `Debes ${formatCLP(owe)}`, owed > 0 && `te deben ${formatCLP(owed)}`].filter(Boolean).join(' · ') || 'Al día'} />
              )}
              {activeInvestments.length > 0 && (
                <ElsewhereRow to="/inversiones" icon={TrendingUp} title="Inversiones" detail={`Valen ${formatCLP(invested)}`} />
              )}
            </ul>
          )}

          {archived.length > 0 && (
            <section>
              <button className="pressable inline-flex items-center gap-1.5 text-sm font-medium text-soft hover:text-ink"
                aria-expanded={showArchived} onClick={() => setShowArchived((v) => !v)}>
                {showArchived ? 'Ocultar' : 'Ver'} cuentas archivadas ({archived.length})
                <ChevronDown size={16} strokeWidth={2} aria-hidden
                  className={`transition-transform duration-300 ease-soft ${showArchived ? 'rotate-180' : ''}`} />
              </button>
              {showArchived && (
                <ul className="stagger mt-3 grid grid-cols-1 gap-3 opacity-75 sm:grid-cols-2">
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

/** "Banco Falabella · Cuenta bancaria", sin repetir lo que ya dice el nombre. */
function accountSubtitle(name: string, instName: string | undefined, instShort: string | undefined, typeLabel: string) {
  const n = normalizeName(name)
  const showInst = instName && !n.includes(normalizeName(instShort ?? instName))
  const showType = !n.includes(normalizeName(typeLabel))
  return [showInst && instName, showType && typeLabel].filter(Boolean).join(' · ')
}

/** Enlace a lo que no es una cuenta (deudas, inversiones), para encontrarlo rápido. */
function ElsewhereRow({ to, icon, title, detail }: { to: string; icon: LucideIcon; title: string; detail: string }) {
  return (
    <li className="border-b border-line last:border-0">
      <Link to={to} className="pressable flex items-center gap-3.5 px-4 py-3.5 hover:bg-subtle/60">
        <IconTile icon={icon} />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{title}</span>
          <span className="block text-xs text-muted">{detail}</span>
        </span>
        <ChevronRight size={18} strokeWidth={2} className="shrink-0 text-muted" aria-hidden />
      </Link>
    </li>
  )
}

function AccountCard({ account: a, onClick }: { account: AccountWithBalance; onClick: () => void }) {
  const inst = institutionById(a.institution)
  const isCard = a.type === 'credit_card'
  const money = useMoney()
  const cur = currencyOf(a)
  const { debt, available, usedPct } = cardStatus({ balance: nativeBalance(a), credit_limit: a.credit_limit })
  const amountCls = 'figure-hero text-[1.375rem] leading-tight'
  // Otra moneda que la de "Ver en": el equivalente, chico, bajo el monto.
  const approx = money.approx(a)

  return (
    <li>
      <button onClick={onClick}
        className="card flex h-full w-full flex-col gap-3 p-4 text-left transition-[border-color,transform] duration-200 hover:border-line-strong/40 active:scale-[0.99] md:p-5">
        <div className="flex items-center gap-3">
          <AccountIcon account={a} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{a.name}{a.archived && ' (archivada)'}</p>
            <p className="truncate text-[0.8125rem] text-muted">{accountSubtitle(a.name, inst?.name, inst?.short, ACCOUNT_TYPES[a.type].label)}</p>
          </div>
        </div>

        {isCard ? (
          <>
            <div>
              <p className="label-caps">Deuda</p>
              <p className={amountCls}>{formatMoney(debt, cur)}</p>
              {approx && <p className="text-xs text-muted">{approx.replace('-', '')}</p>}
            </div>
            {usedPct != null && (
              <ProgressBar pct={usedPct} label={`Cupo utilizado: ${usedPct}%`}
                barClass={usedPct >= 80 ? 'bg-warn-bar' : 'bg-ink'} />
            )}
            <p className="text-xs text-muted">
              {available != null && <>Disponible {formatMoney(available, cur)} de {formatMoney(a.credit_limit!, cur)} · </>}
              {a.closing_day && <>Cierra el {a.closing_day} · </>}
              {a.payment_day && <>Paga el {a.payment_day}</>}
            </p>
          </>
        ) : (
          <div>
            <p className="label-caps">Saldo</p>
            <p className={`${amountCls} ${nativeBalance(a) < 0 ? 'text-neg' : ''}`}>{money.native(a)}</p>
            {approx && <p className="text-xs text-muted">{approx}</p>}
          </div>
        )}
      </button>
    </li>
  )
}
