// Patrimonio neto en el tiempo: activos − deudas a fin de cada mes.
// Una sola serie (línea) en un solo eje; tooltip con el detalle y vista de tabla.
import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownRight, ArrowUpRight, ChartLine } from 'lucide-react'
import { netWorthByMonth, type NetWorthPoint } from '@/data/netWorth'
import { useQuery } from '@/hooks/useQuery'
import { useChartTheme } from '@/lib/chartTheme'
import { currentMonth, monthLabel, monthShort } from '@/lib/dates'
import { formatCLP, formatCLPCompact, formatPct } from '@/lib/format'
import { useAnimatedNumber, useReducedMotion } from '@/lib/motion'
import { Alert, Card, EmptyState, Loading, PageHeader, Segmented, SectionHeader } from '@/components/ui'

type Range = '12' | '24'

export default function NetWorthPage() {
  const theme = useChartTheme()
  const reduced = useReducedMotion()
  const [range, setRange] = useState<Range>('12')
  const [asTable, setAsTable] = useState(false)
  const q = useQuery(() => netWorthByMonth(currentMonth(), Number(range)), [range], ['transactions', 'accounts'])

  const data = q.data ?? []
  const last = data[data.length - 1]
  const first = data[0]
  const empty = data.every((d) => d.assets === 0 && d.liabilities === 0)
  const change = last && first ? last.net - first.net : 0
  const hasNegative = data.some((d) => d.net < 0)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Patrimonio" subtitle="Lo que tienes menos lo que debes, a fin de cada mes."
        action={
          <div className="w-52">
            <Segmented<Range> label="Período" value={range} onChange={setRange}
              options={[{ value: '12', label: '12 meses' }, { value: '24', label: '24 meses' }]} />
          </div>
        } />

      {q.error && <Alert>{q.error}</Alert>}
      {q.loading && !q.data ? <Loading label="Calculando patrimonio…" rows={4} /> : empty ? (
        <EmptyState icon={ChartLine} title="Aún no hay datos">
          Crea tus cuentas y deudas con su saldo actual y registra movimientos: aquí verás cómo crece tu patrimonio mes a mes.
        </EmptyState>
      ) : last && (
        <div className={`flex flex-col gap-6 transition-opacity duration-200 ${q.loading ? 'opacity-60' : ''}`}>
          <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Patrimonio neto" value={last.net} valueClass={last.net < 0 ? 'text-neg' : ''} />
            <Tile label="Activos" value={last.assets} hint="Efectivo, bancos, ahorro y lo que te deben" />
            <Tile label="Deudas" value={last.liabilities} valueClass="text-neg" hint="Tarjetas y préstamos" />
            <div className="card flex flex-col gap-2 p-4 md:p-5">
              <p className="label-caps">Cambio en {range} meses</p>
              <p className={`figure-hero flex items-center gap-1 text-[1.375rem] leading-tight sm:text-[1.75rem] ${change > 0 ? 'text-pos' : change < 0 ? 'text-neg' : ''}`}>
                {change > 0 && <ArrowUpRight size={22} strokeWidth={2.25} aria-hidden />}
                {change < 0 && <ArrowDownRight size={22} strokeWidth={2.25} aria-hidden />}
                <span className="sr-only">{change > 0 ? 'Subió' : change < 0 ? 'Bajó' : 'Sin cambio'} </span>
                {formatCLP(Math.abs(change))}
              </p>
              {/* Un % sobre una base negativa o cero no tiene sentido: solo con base positiva. */}
              {first.net > 0 && change !== 0 && (
                <p className="text-xs text-muted">{formatPct(change / Math.abs(first.net))} desde {monthShort(first.month, true)}</p>
              )}
            </div>
          </div>

          <Card>
            <SectionHeader title="Evolución" action={
              <button onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}
                className="pressable rounded-sm border border-line-strong/45 px-2.5 py-1 text-xs font-semibold hover:bg-subtle">
                {asTable ? 'Ver gráfico' : 'Ver como tabla'}
              </button>
            } />
            {asTable ? <NetWorthTable data={data} /> : (
              <div className="h-72" role="img"
                aria-label={`Patrimonio neto de los últimos ${range} meses: de ${formatCLP(first.net)} a ${formatCLP(last.net)}. Usa "Ver como tabla" para el detalle.`}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="nw-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={theme.net} stopOpacity={0.22} />
                        <stop offset="100%" stopColor={theme.net} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke={theme.grid} />
                    <XAxis dataKey="month" tickFormatter={(m: string) => monthShort(m)} tick={{ fill: theme.axis, fontSize: 11 }}
                      axisLine={{ stroke: theme.grid }} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
                    <YAxis tickFormatter={formatCLPCompact} tick={{ fill: theme.axis, fontSize: 11 }} width={74}
                      axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                    {hasNegative && <ReferenceLine y={0} stroke={theme.axis} strokeWidth={1} />}
                    <Tooltip content={<NetTooltip />} cursor={{ stroke: theme.axis, strokeWidth: 1 }} />
                    <Area type="monotone" dataKey="net" name="Patrimonio" stroke={theme.net} strokeWidth={2} fill="url(#nw-fill)"
                      dot={false} activeDot={{ r: 5, stroke: theme.surface, strokeWidth: 2, fill: theme.net }}
                      isAnimationActive={!reduced} animationDuration={900} animationEasing="ease-out" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className="mt-3 text-xs text-muted">
              Se calcula con el saldo inicial de cada cuenta y tus movimientos. Las compras en cuotas cuentan como deuda
              desde la fecha de compra. Si importaste movimientos antiguos, los meses previos pueden ser aproximados.
            </p>
          </Card>
        </div>
      )}
    </div>
  )
}

function Tile({ label, value, valueClass = '', hint }: { label: string; value: number; valueClass?: string; hint?: string }) {
  const shown = useAnimatedNumber(value)
  return (
    <div className="card flex flex-col gap-2 p-4 md:p-5">
      <p className="label-caps">{label}</p>
      <p className={`figure-hero text-[1.375rem] leading-tight sm:text-[1.75rem] ${valueClass}`}>
        <span className="sr-only">{formatCLP(value)}</span><span aria-hidden>{formatCLP(shown)}</span>
      </p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  )
}

function NetTooltip({ active, payload }: { active?: boolean; payload?: { payload: NetWorthPoint }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-sm border border-line bg-surface px-3 py-2 text-sm shadow-[var(--shadow-float)]">
      <p className="mb-1 font-semibold">{monthLabel(d.month)}</p>
      <p className="tabular-nums">Patrimonio: <strong>{formatCLP(d.net)}</strong></p>
      <p className="tabular-nums text-soft">Activos: {formatCLP(d.assets)}</p>
      <p className="tabular-nums text-soft">Deudas: {formatCLP(d.liabilities)}</p>
    </div>
  )
}

function NetWorthTable({ data }: { data: NetWorthPoint[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Patrimonio neto por mes</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th className="py-2 font-medium">Mes</th>
            <th className="py-2 text-right font-medium">Activos</th>
            <th className="py-2 text-right font-medium">Deudas</th>
            <th className="py-2 text-right font-medium">Patrimonio</th>
          </tr>
        </thead>
        <tbody>
          {[...data].reverse().map((d) => (
            <tr key={d.month} className="border-b border-line last:border-0">
              <td className="py-1.5">{monthLabel(d.month)}</td>
              <td className="py-1.5 text-right tabular-nums">{formatCLP(d.assets)}</td>
              <td className="py-1.5 text-right tabular-nums">{formatCLP(d.liabilities)}</td>
              <td className={`py-1.5 text-right font-medium tabular-nums ${d.net < 0 ? 'text-neg' : ''}`}>{formatCLP(d.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
