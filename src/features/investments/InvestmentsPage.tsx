// Inversiones: cuánto aportaste a cada una, cuánto vale hoy y cuánto ganaste.
// No son cuentas para gastar: los aportes y rescates son transferencias (no
// cuentan como gasto ni ingreso) y el valor se actualiza a mano.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, CircleAlert, Plus, TrendingUp } from 'lucide-react'
import { useRefData } from '@/context/RefData'
import { listInvestmentStatus } from '@/data/investments'
import { useQuery } from '@/hooks/useQuery'
import { formatCLP, formatDate, formatPct, todayISO } from '@/lib/format'
import { investmentGain, needsValuation } from '@/lib/investments'
import { useAnimatedNumber } from '@/lib/motion'
import { AccountIcon } from '@/components/icons'
import { Modal } from '@/components/Modal'
import { Alert, Button, Card, EmptyState, Loading, PageHeader } from '@/components/ui'
import type { AccountWithBalance, InvestmentStatus } from '@/types'
import { InvestmentForm } from './InvestmentForm'
import { ValuationForm } from './ValuationForm'
import { Gain, investmentSubtitle, useInvestmentActions } from './shared'

/** Sin fila en la vista (recién creada): vale lo aportado. */
const fallbackStatus = (a: AccountWithBalance): InvestmentStatus => ({
  account_id: a.id, contributed: a.initial_balance + a.inflow, withdrawn: a.outflow,
  valued_at: null, last_value: null, current_value: Math.max(0, a.balance),
})

export default function InvestmentsPage() {
  const { investments, loading } = useRefData()
  const q = useQuery(listInvestmentStatus, [], ['accounts', 'transactions', 'investments'])
  const actions = useInvestmentActions()
  const [creating, setCreating] = useState(false)
  const [valuing, setValuing] = useState<AccountWithBalance | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const statusOf = (a: AccountWithBalance) => q.data?.get(a.id) ?? fallbackStatus(a)
  const active = investments.filter((a) => !a.archived)
  const archived = investments.filter((a) => a.archived)
  const totals = active.reduce((t, a) => {
    const s = statusOf(a)
    return { contributed: t.contributed + s.contributed, withdrawn: t.withdrawn + s.withdrawn, current_value: t.current_value + s.current_value }
  }, { contributed: 0, withdrawn: 0, current_value: 0 })
  const total = investmentGain(totals)
  const shownValue = useAnimatedNumber(totals.current_value)
  const shownContributed = useAnimatedNumber(totals.contributed - totals.withdrawn)

  if (loading || (q.loading && !q.data)) return <Loading label="Cargando inversiones…" rows={4} />

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Inversiones" subtitle="Lo que aportas, lo que vale y lo que ganas."
        action={active.length > 0 && <Button icon={Plus} onClick={() => setCreating(true)}>Nueva inversión</Button>} />

      {q.error && <Alert>{q.error}</Alert>}

      {active.length === 0 && archived.length === 0 ? (
        <EmptyState icon={TrendingUp} title="Sigue tus inversiones"
          action={<Button icon={Plus} onClick={() => setCreating(true)}>Nueva inversión</Button>}>
          Registra tus fondos mutuos, acciones, depósitos a plazo, cripto o APV: cuánto aportas, cuánto vale hoy y
          cuánto has ganado. Aportar no cuenta como gasto.
        </EmptyState>
      ) : (
        <>
          {active.length > 0 && (
            <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-3">
              <div className="card col-span-2 flex flex-col gap-2 p-4 md:p-5 lg:col-span-1">
                <p className="label-caps">Valor actual</p>
                <p className="figure-hero text-[1.75rem] leading-tight sm:text-[2rem]">
                  <span className="sr-only">{formatCLP(totals.current_value)}</span><span aria-hidden>{formatCLP(shownValue)}</span>
                </p>
                <p className="text-xs text-muted">{active.length === 1 ? '1 inversión' : `${active.length} inversiones`}</p>
              </div>
              <div className="card flex flex-col gap-2 p-4 md:p-5">
                <p className="label-caps">Aportado</p>
                <p className="figure-hero text-[1.375rem] leading-tight sm:text-[1.75rem]">
                  <span className="sr-only">{formatCLP(totals.contributed - totals.withdrawn)}</span>
                  <span aria-hidden>{formatCLP(shownContributed)}</span>
                </p>
                <p className="text-xs text-muted">{totals.withdrawn > 0 ? `Ya descontado lo rescatado (${formatCLP(totals.withdrawn)})` : 'Lo que pusiste de tu bolsillo'}</p>
              </div>
              <div className="card flex flex-col gap-2 p-4 md:p-5">
                <p className="label-caps">Ganancia</p>
                <p className="text-[1.25rem] leading-tight sm:text-[1.5rem]"><Gain gain={total.gain} pct={null} /></p>
                <p className="text-xs text-muted">
                  {total.pct != null && total.gain !== 0
                    ? `${total.gain > 0 ? '+' : '−'}${formatPct(total.pct)} sobre lo aportado`
                    : 'Valor + rescates − aportes'}
                </p>
              </div>
            </div>
          )}

          <ul className="stagger grid grid-cols-1 gap-3 md:grid-cols-2">
            {active.map((a) => {
              const s = statusOf(a)
              const g = investmentGain(s)
              const stale = needsValuation(s, todayISO())
              return (
                <li key={a.id} className="min-w-0">
                  <Card pad="sm" className="flex h-full flex-col gap-3 md:p-5">
                    <Link to={`/inversiones/${a.id}`} className="-m-1 flex items-start gap-3 rounded-sm p-1 transition-colors duration-200 hover:bg-subtle/50">
                      <AccountIcon account={a} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{a.name}</p>
                        <p className="truncate text-[0.8125rem] text-muted">{investmentSubtitle(a) || 'Inversión'}</p>
                      </div>
                      <ChevronRight size={18} strokeWidth={2} className="mt-2.5 shrink-0 text-muted" aria-hidden />
                    </Link>
                    <div>
                      <p className="label-caps">Vale</p>
                      <p className="text-[1.375rem] leading-tight font-bold tracking-[-0.02em] tabular-nums">{formatCLP(s.current_value)}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <Gain gain={g.gain} pct={g.pct} />
                        <span className="text-xs text-muted">· aportado {formatCLP(s.contributed - s.withdrawn)}</span>
                      </p>
                    </div>
                    {stale ? (
                      <p className="flex items-center gap-1.5 text-xs font-medium text-warn">
                        <CircleAlert size={14} strokeWidth={2.25} aria-hidden />
                        {s.valued_at ? `Actualiza su valor (el último es del ${formatDate(s.valued_at)})` : 'Registra cuánto vale hoy para ver tu ganancia'}
                      </p>
                    ) : s.valued_at && <p className="text-xs text-muted">Valor al {formatDate(s.valued_at)}</p>}
                    <div className="mt-auto flex flex-wrap justify-end gap-2 pt-1">
                      <Button size="sm" variant="secondary" onClick={() => setValuing(a)}>Actualizar valor</Button>
                      <Button size="sm" onClick={() => actions.contribute(a)}>Aportar</Button>
                    </div>
                  </Card>
                </li>
              )
            })}
          </ul>

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
                      <Link to={`/inversiones/${a.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-subtle/60">
                        <AccountIcon account={a} size="sm" />
                        <span className="min-w-0 flex-1 truncate font-medium">{a.name}</span>
                        <ChevronRight size={18} strokeWidth={2} className="text-muted" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <p className="text-xs leading-relaxed text-muted">
            La ganancia se calcula con el último valor que registraste más los aportes y rescates posteriores.
            Aportar o rescatar mueve dinero de tus cuentas sin contar como gasto ni ingreso.
          </p>
        </>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Nueva inversión">
        {creating && <InvestmentForm onDone={() => setCreating(false)} />}
      </Modal>
      <Modal open={valuing !== null} onClose={() => setValuing(null)} title="Actualizar valor">
        {valuing && <ValuationForm investment={valuing} status={statusOf(valuing)} onDone={() => setValuing(null)} />}
      </Modal>
    </div>
  )
}
