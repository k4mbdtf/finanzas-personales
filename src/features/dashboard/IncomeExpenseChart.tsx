// Barras de ingresos vs gastos de los últimos 12 meses (un solo eje Y).
// Verde = ingresos, rojo = gastos; siempre con leyenda, orden fijo (ingreso a la
// izquierda), separación entre barras, tooltip y vista de tabla.
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useChartTheme } from '@/lib/chartTheme'
import { monthLabel, monthShort } from '@/lib/dates'
import { formatCLP, formatCLPCompact } from '@/lib/format'
import { useReducedMotion } from '@/lib/motion'
import type { MonthTotal } from '@/data/dashboard'

export function IncomeExpenseChart({ data }: { data: MonthTotal[] }) {
  const theme = useChartTheme()
  const reduced = useReducedMotion()
  const [asTable, setAsTable] = useState(false)
  const empty = data.every((d) => d.income === 0 && d.expense === 0)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-4 text-sm" aria-hidden={asTable}>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-xs" style={{ backgroundColor: theme.income }} />Ingresos</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-xs" style={{ backgroundColor: theme.expense }} />Gastos</span>
        </div>
        <button onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}
          className="pressable rounded-sm border border-line-strong/45 px-2.5 py-1 text-xs font-semibold hover:bg-subtle">
          {asTable ? 'Ver gráfico' : 'Ver como tabla'}
        </button>
      </div>

      {empty ? (
        <p className="py-8 text-center text-sm text-soft">Todavía no hay movimientos en estos 12 meses.</p>
      ) : asTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Ingresos y gastos por mes</caption>
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-2 font-medium">Mes</th>
                <th className="py-2 text-right font-medium">Ingresos</th>
                <th className="py-2 text-right font-medium">Gastos</th>
                <th className="py-2 text-right font-medium">Ahorro</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.month} className="border-b border-line last:border-0">
                  <td className="py-1.5">{monthLabel(d.month)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatCLP(d.income)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatCLP(d.expense)}</td>
                  <td className={`py-1.5 text-right tabular-nums ${d.income - d.expense < 0 ? 'text-neg' : ''}`}>
                    {formatCLP(d.income - d.expense)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-64" role="img" aria-label="Gráfico de ingresos y gastos de los últimos 12 meses. Usa 'Ver como tabla' para leer los valores.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={2} barCategoryGap="22%" margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={theme.grid} />
              <XAxis dataKey="month" tickFormatter={(m: string) => monthShort(m)} tick={{ fill: theme.axis, fontSize: 11 }}
                axisLine={{ stroke: theme.grid }} tickLine={false} interval="preserveStartEnd" minTickGap={4} />
              <YAxis tickFormatter={formatCLPCompact} tick={{ fill: theme.axis, fontSize: 11 }} width={74}
                axisLine={false} tickLine={false} />
              <Tooltip content={<BarTooltip />} cursor={{ fill: theme.grid, opacity: 0.5 }} />
              <Bar dataKey="income" name="Ingresos" fill={theme.income} radius={[2, 2, 0, 0]} maxBarSize={18}
                isAnimationActive={!reduced} animationDuration={700} animationEasing="ease-out" />
              <Bar dataKey="expense" name="Gastos" fill={theme.expense} radius={[2, 2, 0, 0]} maxBarSize={18}
                isAnimationActive={!reduced} animationDuration={700} animationEasing="ease-out" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function BarTooltip({ active, payload, label }: {
  active?: boolean; payload?: { payload: MonthTotal }[]; label?: string
}) {
  if (!active || !payload?.length || !label) return null
  const d = payload[0].payload
  const saving = d.income - d.expense
  return (
    <div className="rounded-sm border border-line bg-surface px-3 py-2 text-sm shadow-[var(--shadow-float)]">
      <p className="mb-1 font-semibold">{monthLabel(label)}</p>
      <p className="tabular-nums">Ingresos: {formatCLP(d.income)}</p>
      <p className="tabular-nums">Gastos: {formatCLP(d.expense)}</p>
      <p className="tabular-nums">Ahorro: {formatCLP(saving)}</p>
    </div>
  )
}
