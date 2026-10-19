// Tarjetas de KPIs: saldo total, ingresos, gastos y ahorro del mes,
// con variación respecto al mes anterior (flecha + texto, no solo color).
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { formatCLP, formatPct } from '@/lib/format'
import { monthShort } from '@/lib/dates'
import type { MonthTotal } from '@/data/dashboard'

type Polarity = 'up-good' | 'up-bad'

function Delta({ current, previous, polarity, prevLabel, absolute }: {
  current: number; previous: number; polarity: Polarity; prevLabel: string; absolute?: boolean
}) {
  if (previous === 0 && !absolute) {
    return <p className="text-xs text-slate-500 dark:text-slate-400">Sin datos de {prevLabel}</p>
  }
  const diff = current - previous
  if (diff === 0) return <p className="text-xs text-slate-500 dark:text-slate-400">= Igual que {prevLabel}</p>
  const up = diff > 0
  const good = polarity === 'up-good' ? up : !up
  const value = absolute ? formatCLP(Math.abs(diff)) : formatPct(diff / Math.abs(previous))
  return (
    <p className={`text-xs font-medium ${good ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
      <span aria-hidden>{up ? '▲' : '▼'} </span>
      <span className="sr-only">{up ? 'Subió' : 'Bajó'} </span>
      {value} vs {prevLabel}
    </p>
  )
}

function Tile({ label, value, valueClass = '', children }: {
  label: string; value: number; valueClass?: string; children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <p className="text-sm text-slate-600 dark:text-slate-300">{label}</p>
      <p className={`text-xl font-bold sm:text-2xl ${valueClass}`}>{formatCLP(value)}</p>
      {children}
    </div>
  )
}

export function Kpis({ totalBalance, current, previous }: {
  totalBalance: number; current: MonthTotal; previous: MonthTotal
}) {
  const prevLabel = monthShort(previous.month)
  const saving = current.income - current.expense
  const prevSaving = previous.income - previous.expense
  const rate = current.income > 0 ? saving / current.income : null

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile label="Saldo total" value={totalBalance} valueClass={totalBalance < 0 ? 'text-red-700 dark:text-red-400' : ''}>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Cuentas menos deudas · <Link to="/patrimonio" className="font-medium text-teal-700 underline dark:text-teal-400">ver evolución</Link>
        </p>
      </Tile>
      <Tile label="Ingresos del mes" value={current.income} valueClass="text-green-700 dark:text-green-400">
        <Delta current={current.income} previous={previous.income} polarity="up-good" prevLabel={prevLabel} />
      </Tile>
      <Tile label="Gastos del mes" value={current.expense} valueClass="text-red-700 dark:text-red-400">
        <Delta current={current.expense} previous={previous.expense} polarity="up-bad" prevLabel={prevLabel} />
      </Tile>
      <Tile label={rate != null ? `Ahorro (${formatPct(rate)} de ingresos)` : 'Ahorro del mes'} value={saving}
        valueClass={saving < 0 ? 'text-red-700 dark:text-red-400' : ''}>
        <Delta current={saving} previous={prevSaving} polarity="up-good" prevLabel={prevLabel} absolute />
      </Tile>
    </div>
  )
}
