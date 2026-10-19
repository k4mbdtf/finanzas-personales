// Dona de gastos del mes por categoría.
// Máximo 6 segmentos (top 5 + "Otros") para que se lea de un vistazo. Cada
// segmento usa el color de su categoría (el mismo que en el resto de la app) y la
// leyenda muestra nombre, monto y %: el color nunca es la única forma de leerlo.
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useRefData } from '@/context/RefData'
import { useChartTheme } from '@/lib/chartTheme'
import { formatCLP, formatPct } from '@/lib/format'
import { iconFor } from '@/lib/icons'

const MAX_SLICES = 6

type Slice = { key: string; name: string; icon: string; color: string; value: number }

export function SpendingDonut({ spending }: { spending: Map<string, number> }) {
  const { categoryById } = useRefData()
  const theme = useChartTheme()

  const all: Slice[] = [...spending]
    .filter(([, v]) => v > 0)
    .map(([id, value]) => {
      const c = categoryById.get(id)
      return { key: id || 'none', name: c?.name ?? 'Sin categoría', icon: iconFor(c?.icon), color: c?.color ?? theme.other, value }
    })
    .sort((a, b) => b.value - a.value)

  const total = all.reduce((s, x) => s + x.value, 0)
  const slices = all.length <= MAX_SLICES
    ? all
    : [...all.slice(0, MAX_SLICES - 1), {
        key: 'other', name: `Otros (${all.length - MAX_SLICES + 1})`, icon: '…', color: theme.other,
        value: all.slice(MAX_SLICES - 1).reduce((s, x) => s + x.value, 0),
      }]

  if (total === 0) {
    return <p className="py-8 text-center text-sm text-slate-600 dark:text-slate-300">Aún no hay gastos este mes.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative mx-auto h-52 w-full max-w-60" role="img"
        aria-label={`Gastos por categoría, total ${formatCLP(total)}. ${slices.map((s) => `${s.name} ${formatPct(s.value / total)}`).join(', ')}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="95%"
              stroke={theme.surface} strokeWidth={2} isAnimationActive={false} startAngle={90} endAngle={-270}>
              {slices.map((s) => <Cell key={s.key} fill={s.color} />)}
            </Pie>
            <Tooltip content={<DonutTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total gastos</p>
            <p className="text-lg font-bold">{formatCLP(total)}</p>
          </div>
        </div>
      </div>

      {/* Leyenda = vista de tabla: todos los valores legibles sin hover. */}
      <table className="w-full text-sm">
        <caption className="sr-only">Gastos por categoría</caption>
        <thead className="sr-only"><tr><th>Categoría</th><th>Monto</th><th>Porcentaje</th></tr></thead>
        <tbody>
          {slices.map((s) => (
            <tr key={s.key} className="border-b border-slate-100 last:border-0 dark:border-slate-700">
              {/* max-w-0 + w-full: la columna del nombre cede espacio y se trunca. */}
              <td className="w-full max-w-0 py-1.5">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                  <span className="truncate">{s.name}</span>
                </span>
              </td>
              <td className="py-1.5 pl-3 text-right whitespace-nowrap tabular-nums">{formatCLP(s.value)}</td>
              <td className="py-1.5 pl-3 text-right whitespace-nowrap text-slate-500 tabular-nums dark:text-slate-400">{formatPct(s.value / total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DonutTooltip({ active, payload, total }: {
  active?: boolean; payload?: { payload: Slice }[]; total: number
}) {
  if (!active || !payload?.length) return null
  const s = payload[0].payload
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-md dark:border-slate-600 dark:bg-slate-900">
      <p className="font-medium">{s.icon} {s.name}</p>
      <p className="tabular-nums">{formatCLP(s.value)} · {formatPct(s.value / total)}</p>
    </div>
  )
}
