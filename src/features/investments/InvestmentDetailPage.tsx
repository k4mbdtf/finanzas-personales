// Detalle de una inversión: valor actual, ganancia, el gráfico de valor vs lo
// aportado, los valores registrados y los aportes y rescates.
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Area, ComposedChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Pencil, Trash2, TrendingUp } from 'lucide-react'
import { useRefData } from '@/context/RefData'
import { deleteValuation, listInvestmentStatus, listValuations } from '@/data/investments'
import { listTransactions } from '@/data/transactions'
import { useQuery } from '@/hooks/useQuery'
import { useChartTheme } from '@/lib/chartTheme'
import { formatCLP, formatCLPCompact, formatDate, todayISO } from '@/lib/format'
import { investmentGain, needsValuation, valueSeries, type SeriesPoint } from '@/lib/investments'
import { useAnimatedNumber, useReducedMotion } from '@/lib/motion'
import { BackLink } from '@/components/BackLink'
import { useConfirm, useToast } from '@/components/Feedback'
import { AccountIcon } from '@/components/icons'
import { Modal } from '@/components/Modal'
import { Alert, Button, Card, EmptyState, Loading, SectionHeader } from '@/components/ui'
import { TransactionList } from '@/features/transactions/TransactionList'
import { useTransactionDrawer } from '@/features/transactions/TransactionDrawer'
import type { AccountWithBalance, InvestmentStatus } from '@/types'
import { InvestmentForm } from './InvestmentForm'
import { ValuationForm } from './ValuationForm'
import { Gain, investmentSubtitle, useInvestmentActions } from './shared'

export default function InvestmentDetailPage() {
  const { id = '' } = useParams()
  const { accountById, loading } = useRefData()
  const a = accountById.get(id)
  if (loading) return <Loading label="Cargando…" />
  if (!a || a.type !== 'investment') {
    return (
      <EmptyState icon={TrendingUp} title="No encontramos esta inversión"
        action={<Link to="/inversiones" className="link">Volver a Inversiones</Link>}>
        Puede que la hayas eliminado.
      </EmptyState>
    )
  }
  return <Detail key={a.id} investment={a} />
}

function Detail({ investment: a }: { investment: AccountWithBalance }) {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const actions = useInvestmentActions()
  const { openEdit } = useTransactionDrawer()
  const [editing, setEditing] = useState(false)
  const [valuing, setValuing] = useState(false)
  const [asTable, setAsTable] = useState(false)

  const status = useQuery(listInvestmentStatus, [], ['accounts', 'transactions', 'investments'])
  const vals = useQuery(() => listValuations(a.id), [a.id], ['investments'])
  const moves = useQuery(
    () => listTransactions({ from: '1900-01-01', to: '2999-12-31', accountId: a.id }, 300),
    [a.id], ['transactions'],
  )

  const s: InvestmentStatus = status.data?.get(a.id) ?? {
    account_id: a.id, contributed: a.initial_balance + a.inflow, withdrawn: a.outflow,
    valued_at: null, last_value: null, current_value: Math.max(0, a.balance),
  }
  const g = investmentGain(s)
  const shown = useAnimatedNumber(s.current_value)
  const today = todayISO()

  const series = useMemo(() => {
    const rows = moves.data?.rows ?? []
    const flows = rows.map((t) => ({
      date: t.date, created_at: t.created_at,
      delta: t.to_account_id === a.id || (t.account_id === a.id && t.type === 'income') ? t.amount : -t.amount,
    }))
    const valuations = (vals.data ?? []).map((v) => ({ date: v.date, created_at: v.created_at, value: v.value }))
    return valueSeries(a.initial_balance, a.created_at.slice(0, 10), flows, valuations, today)
  }, [moves.data, vals.data, a.id, a.initial_balance, a.created_at, today])

  async function removeValuation(id: string, date: string) {
    const ok = await confirm({
      title: 'Eliminar valor', message: `¿Eliminar el valor registrado el ${formatDate(date)}?`,
      confirmLabel: 'Eliminar', danger: true,
    })
    if (!ok) return
    try {
      await deleteValuation(id)
      toast('Valor eliminado')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo eliminar.', 'error')
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <BackLink to="/inversiones">Inversiones</BackLink>
        <header className="flex items-center gap-4">
          <AccountIcon account={a} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="line-clamp-2 text-[1.625rem] leading-tight font-bold tracking-[-0.03em] break-words md:text-[1.875rem]">{a.name}</h1>
            <p className="truncate text-sm text-muted">{[investmentSubtitle(a) || 'Inversión', a.archived && 'Archivada'].filter(Boolean).join(' · ')}</p>
          </div>
          <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditing(true)}>Editar</Button>
        </header>
      </div>

      <Card className="flex flex-col gap-5">
        <div>
          <p className="label-caps">Vale hoy</p>
          <p className="figure-hero mt-1 text-[2.25rem] leading-none md:text-[2.75rem]">
            <span className="sr-only">{formatCLP(s.current_value)}</span><span aria-hidden>{formatCLP(shown)}</span>
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm">
            <Gain gain={g.gain} pct={g.pct} />
            <span className="text-xs text-muted">
              {s.valued_at ? `según el valor del ${formatDate(s.valued_at)}` : 'aún sin valor registrado: vale lo aportado'}
            </span>
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 sm:grid-cols-3">
          <Fact label="Aportado" value={formatCLP(s.contributed)} />
          <Fact label="Rescatado" value={formatCLP(s.withdrawn)} />
          <Fact label="Invertido neto" value={formatCLP(s.contributed - s.withdrawn)} />
        </dl>
        {needsValuation(s, today) && (
          <Alert kind="warning">
            {s.valued_at ? 'Hace más de un mes que no actualizas su valor.' : 'Registra cuánto vale hoy para ver tu ganancia real.'}
          </Alert>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => actions.contribute(a)}>Aportar</Button>
          <Button variant="secondary" onClick={() => setValuing(true)}>Actualizar valor</Button>
          {s.current_value > 0 && <Button variant="secondary" onClick={() => actions.withdraw(a)}>Rescatar</Button>}
        </div>
      </Card>

      {series.length >= 2 && (
        <Card>
          <SectionHeader title="Valor y aportado" action={
            <button onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}
              className="pressable rounded-sm border border-line-strong/45 px-2.5 py-1 text-xs font-semibold hover:bg-subtle">
              {asTable ? 'Ver gráfico' : 'Ver como tabla'}
            </button>
          } />
          {asTable ? <SeriesTable data={series} /> : <ValueChart data={series} name={a.name} />}
        </Card>
      )}

      <section>
        <SectionHeader title="Valores registrados" />
        {vals.error && <Alert>{vals.error}</Alert>}
        {vals.loading && !vals.data ? <Loading rows={2} />
          : vals.data && vals.data.length > 0 ? (
            <ul className="card overflow-hidden">
              {vals.data.map((v) => (
                <li key={v.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{formatDate(v.date)}</p>
                    {v.note && <p className="truncate text-[0.8125rem] text-muted">{v.note}</p>}
                  </div>
                  <span className="font-semibold tabular-nums">{formatCLP(v.value)}</span>
                  <button type="button" onClick={() => removeValuation(v.id, v.date)} aria-label={`Eliminar valor del ${formatDate(v.date)}`}
                    className="pressable grid size-9 place-items-center rounded-full text-muted hover:bg-subtle hover:text-neg">
                    <Trash2 size={16} strokeWidth={2} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-soft">Aún no registras su valor. Usa <strong>Actualizar valor</strong> cuando revises la app de tu banco o corredora.</p>}
      </section>

      <section>
        <SectionHeader title="Aportes y rescates" />
        {moves.error && <Alert>{moves.error}</Alert>}
        {moves.loading && !moves.data ? <Loading rows={2} />
          : moves.data && moves.data.rows.length > 0
            ? <TransactionList rows={moves.data.rows} onSelect={openEdit} />
            : <p className="text-sm text-soft">Aún no hay aportes ni rescates registrados.</p>}
      </section>

      <Modal open={editing} onClose={() => setEditing(false)} title="Editar inversión">
        {editing && <InvestmentForm investment={a} onDone={() => setEditing(false)} onDeleted={() => navigate('/inversiones', { replace: true })} />}
      </Modal>
      <Modal open={valuing} onClose={() => setValuing(false)} title="Actualizar valor">
        {valuing && <ValuationForm investment={a} status={s} onDone={() => setValuing(false)} />}
      </Modal>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

const ts = (iso: string) => Date.parse(`${iso}T12:00:00Z`)
const shortDate = (t: number) =>
  new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(t))

/** Dos series en un solo eje (ambas en pesos): valor (área) y aportado neto (escalón). */
function ValueChart({ data, name }: { data: SeriesPoint[]; name: string }) {
  const theme = useChartTheme()
  const reduced = useReducedMotion()
  const points = data.map((d) => ({ ...d, t: ts(d.date) }))
  const first = data[0]
  const last = data[data.length - 1]
  return (
    <div className="h-72" role="img"
      aria-label={`${name}: valor de ${formatCLP(first.value)} a ${formatCLP(last.value)} entre el ${formatDate(first.date)} y el ${formatDate(last.date)}; aportado neto ${formatCLP(last.invested)}. Usa "Ver como tabla" para el detalle.`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="inv-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={theme.net} stopOpacity={0.16} />
              <stop offset="100%" stopColor={theme.net} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={theme.grid} />
          <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={shortDate}
            tick={{ fill: theme.axis, fontSize: 11 }} axisLine={{ stroke: theme.grid }} tickLine={false} minTickGap={24} />
          <YAxis tickFormatter={formatCLPCompact} tick={{ fill: theme.axis, fontSize: 11 }} width={74}
            axisLine={false} tickLine={false} domain={['auto', 'auto']} />
          <Tooltip content={<SeriesTooltip />} cursor={{ stroke: theme.axis, strokeWidth: 1 }} />
          <Legend verticalAlign="top" align="left" height={28} iconType="plainline" iconSize={14}
            formatter={(v: string) => <span style={{ color: theme.text, fontSize: 12 }}>{v}</span>} />
          <Area type="linear" dataKey="value" name="Valor" stroke={theme.net} strokeWidth={2} fill="url(#inv-fill)"
            dot={false} activeDot={{ r: 5, stroke: theme.surface, strokeWidth: 2, fill: theme.net }}
            isAnimationActive={!reduced} animationDuration={900} animationEasing="ease-out" />
          <Line type="stepAfter" dataKey="invested" name="Aportado neto" stroke={theme.invested} strokeWidth={2}
            dot={false} activeDot={{ r: 5, stroke: theme.surface, strokeWidth: 2, fill: theme.invested }}
            isAnimationActive={!reduced} animationDuration={900} animationEasing="ease-out" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function SeriesTooltip({ active, payload }: { active?: boolean; payload?: { payload: SeriesPoint }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const gain = d.value - d.invested
  return (
    <div className="rounded-sm border border-line bg-surface px-3 py-2 text-sm shadow-[var(--shadow-float)]">
      <p className="mb-1 font-semibold">{formatDate(d.date)}</p>
      <p className="tabular-nums">Valor: <strong>{formatCLP(d.value)}</strong></p>
      <p className="tabular-nums text-soft">Aportado neto: {formatCLP(d.invested)}</p>
      <p className="tabular-nums text-soft">Diferencia: {gain >= 0 ? '+' : '−'}{formatCLP(Math.abs(gain))}</p>
    </div>
  )
}

function SeriesTable({ data }: { data: SeriesPoint[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Valor y aportado neto por fecha</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th className="py-2 font-medium">Fecha</th>
            <th className="py-2 text-right font-medium">Aportado neto</th>
            <th className="py-2 text-right font-medium">Valor</th>
          </tr>
        </thead>
        <tbody>
          {[...data].reverse().map((d) => (
            <tr key={d.date} className="border-b border-line last:border-0">
              <td className="py-1.5">{formatDate(d.date)}</td>
              <td className="py-1.5 text-right tabular-nums">{formatCLP(d.invested)}</td>
              <td className="py-1.5 text-right font-medium tabular-nums">{formatCLP(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
