// Tarjetas de KPIs: saldo total, ingresos, gastos y ahorro del mes,
// con variación respecto al mes anterior (flecha + texto, no solo color).
// Las cifras "cuentan" suavemente al aparecer (se desactiva con reducir movimiento).
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, Equal } from 'lucide-react'
import { formatCLP, formatPct } from '@/lib/format'
import { monthShort } from '@/lib/dates'
import { useAnimatedNumber } from '@/lib/motion'
import type { MonthTotal } from '@/data/dashboard'

type Polarity = 'up-good' | 'up-bad'

function Delta({ current, previous, polarity, prevLabel, absolute }: {
  current: number; previous: number; polarity: Polarity; prevLabel: string; absolute?: boolean
}) {
  if (previous === 0 && !absolute) {
    return <p className="text-xs text-muted">Sin datos de {prevLabel}</p>
  }
  const diff = current - previous
  if (diff === 0) {
    return <p className="flex items-center gap-1 text-xs text-muted"><Equal size={14} aria-hidden /> Igual que {prevLabel}</p>
  }
  const up = diff > 0
  const good = polarity === 'up-good' ? up : !up
  const value = absolute ? formatCLP(Math.abs(diff)) : formatPct(diff / Math.abs(previous))
  const Arrow = up ? ArrowUpRight : ArrowDownRight
  return (
    <p className={`flex items-center gap-1 text-xs font-medium ${good ? 'text-pos' : 'text-neg'}`}>
      <Arrow size={14} strokeWidth={2.25} aria-hidden />
      <span className="sr-only">{up ? 'Subió' : 'Bajó'} </span>
      {value} vs {prevLabel}
    </p>
  )
}

function Tile({ label, value, valueClass = '', children }: {
  label: string; value: number; valueClass?: string; children?: ReactNode
}) {
  const shown = useAnimatedNumber(value)
  return (
    <div className="card flex flex-col gap-2 p-4 md:p-5">
      <p className="label-caps">{label}</p>
      <p className={`figure-hero text-[1.375rem] leading-tight sm:text-[1.75rem] ${valueClass}`}>
        <span className="sr-only">{formatCLP(value)}</span>
        <span aria-hidden>{formatCLP(shown)}</span>
      </p>
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
    <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile label="Saldo en cuentas" value={totalBalance} valueClass={totalBalance < 0 ? 'text-neg' : ''}>
        <p className="text-xs text-muted">
          Tarjetas descontadas · <Link to="/patrimonio" className="link">patrimonio</Link>
        </p>
      </Tile>
      <Tile label="Ingresos" value={current.income} valueClass="text-pos">
        <Delta current={current.income} previous={previous.income} polarity="up-good" prevLabel={prevLabel} />
      </Tile>
      <Tile label="Gastos" value={current.expense} valueClass="text-neg">
        <Delta current={current.expense} previous={previous.expense} polarity="up-bad" prevLabel={prevLabel} />
      </Tile>
      <Tile label={rate != null ? `Ahorro · ${formatPct(rate)}` : 'Ahorro'} value={saving}
        valueClass={saving < 0 ? 'text-neg' : ''}>
        <Delta current={saving} previous={prevSaving} polarity="up-good" prevLabel={prevLabel} absolute />
      </Tile>
    </div>
  )
}
