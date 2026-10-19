// Patrimonio neto en el tiempo: activos − deudas a fin de cada mes.
// Una sola serie (línea) en un solo eje; tooltip con el detalle y vista de tabla.
import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { netWorthByMonth, type NetWorthPoint } from '@/data/netWorth'
import { useQuery } from '@/hooks/useQuery'
import { useChartTheme } from '@/lib/chartTheme'
import { currentMonth, monthLabel, monthShort } from '@/lib/dates'
import { formatCLP, formatCLPCompact, formatPct } from '@/lib/format'
import { Alert, Card, EmptyState, Segmented, Spinner } from '@/components/ui'

type Range = '12' | '24'

export default function NetWorthPage() {
  const theme = useChartTheme()
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
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Patrimonio neto</h1>
        <div className="w-48">
          <Segmented<Range> label="Período" value={range} onChange={setRange}
            options={[{ value: '12', label: '12 meses' }, { value: '24', label: '24 meses' }]} />
        </div>
      </div>

      {q.error && <Alert>{q.error}</Alert>}
      {q.loading && !q.data ? <Spinner label="Calculando patrimonio…" /> : empty ? (
        <EmptyState icon="📈" title="Aún no hay datos">
          Crea tus cuentas y deudas con su saldo actual y registra movimientos: aquí verás cómo crece tu patrimonio mes a mes.
        </EmptyState>
      ) : last && (
        <div className={`flex flex-col gap-5 transition-opacity ${q.loading ? 'opacity-60' : ''}`}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Patrimonio neto" value={last.net} valueClass={last.net < 0 ? 'text-red-700 dark:text-red-400' : ''} />
            <Tile label="Activos" value={last.assets} hint="Efectivo, bancos, ahorro y lo que te deben" />
            <Tile label="Deudas" value={last.liabilities} valueClass="text-red-700 dark:text-red-400" hint="Tarjetas y préstamos" />
            <div className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
              <p className="text-sm text-slate-600 dark:text-slate-300">Cambio en {range} meses</p>
              <p className={`text-xl font-bold sm:text-2xl ${change > 0 ? 'text-green-700 dark:text-green-400' : change < 0 ? 'text-red-700 dark:text-red-400' : ''}`}>
                <span aria-hidden>{change > 0 ? '▲ ' : change < 0 ? '▼ ' : ''}</span>
                <span className="sr-only">{change > 0 ? 'Subió' : change < 0 ? 'Bajó' : 'Sin cambio'} </span>
                {formatCLP(Math.abs(change))}
              </p>
              {/* Un % sobre una base negativa o cero no tiene sentido: solo con base positiva. */}
              {first.net > 0 && change !== 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">{formatPct(change / Math.abs(first.net))} desde {monthShort(first.month, true)}</p>
              )}
            </div>
          </div>

          <Card>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Patrimonio a fin de mes</h2>
              <button onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700">
                {asTable ? 'Ver gráfico' : 'Ver como tabla'}
              </button>
            </div>
            {asTable ? <NetWorthTable data={data} /> : (
              <div className="h-64" role="img"
                aria-label={`Patrimonio neto de los últimos ${range} meses: de ${formatCLP(first.net)} a ${formatCLP(last.net)}. Usa "Ver como tabla" para el detalle.`}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={theme.grid} />
                    <XAxis dataKey="month" tickFormatter={(m: string) => monthShort(m)} tick={{ fill: theme.axis, fontSize: 11 }}
                      axisLine={{ stroke: theme.grid }} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
                    <YAxis tickFormatter={formatCLPCompact} tick={{ fill: theme.axis, fontSize: 11 }} width={66}
                      axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                    {hasNegative && <ReferenceLine y={0} stroke={theme.axis} strokeWidth={1} />}
                    <Tooltip content={<NetTooltip />} cursor={{ stroke: theme.axis, strokeWidth: 1 }} />
                    <Line type="monotone" dataKey="net" name="Patrimonio" stroke={theme.net} strokeWidth={2}
                      dot={false} activeDot={{ r: 5, stroke: theme.surface, strokeWidth: 2, fill: theme.net }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
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
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <p className="text-sm text-slate-600 dark:text-slate-300">{label}</p>
      <p className={`text-xl font-bold sm:text-2xl ${valueClass}`}>{formatCLP(value)}</p>
      {hint && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  )
}

function NetTooltip({ active, payload }: { active?: boolean; payload?: { payload: NetWorthPoint }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-md dark:border-slate-600 dark:bg-slate-900">
      <p className="mb-1 font-semibold">{monthLabel(d.month)}</p>
      <p className="tabular-nums">Patrimonio: <strong>{formatCLP(d.net)}</strong></p>
      <p className="tabular-nums text-slate-600 dark:text-slate-300">Activos: {formatCLP(d.assets)}</p>
      <p className="tabular-nums text-slate-600 dark:text-slate-300">Deudas: {formatCLP(d.liabilities)}</p>
    </div>
  )
}

function NetWorthTable({ data }: { data: NetWorthPoint[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Patrimonio neto por mes</caption>
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
            <th className="py-2 font-medium">Mes</th>
            <th className="py-2 text-right font-medium">Activos</th>
            <th className="py-2 text-right font-medium">Deudas</th>
            <th className="py-2 text-right font-medium">Patrimonio</th>
          </tr>
        </thead>
        <tbody>
          {[...data].reverse().map((d) => (
            <tr key={d.month} className="border-b border-slate-100 last:border-0 dark:border-slate-700">
              <td className="py-1.5">{monthLabel(d.month)}</td>
              <td className="py-1.5 text-right tabular-nums">{formatCLP(d.assets)}</td>
              <td className="py-1.5 text-right tabular-nums">{formatCLP(d.liabilities)}</td>
              <td className={`py-1.5 text-right font-medium tabular-nums ${d.net < 0 ? 'text-red-700 dark:text-red-400' : ''}`}>{formatCLP(d.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
