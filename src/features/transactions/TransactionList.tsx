// Lista de movimientos agrupada por día. Se reutiliza en Inicio (últimos movimientos).
import { useRefData } from '@/context/RefData'
import { dayLabel } from '@/lib/dates'
import { formatCLP } from '@/lib/format'
import { iconFor } from '@/lib/icons'
import type { Transaction } from '@/types'

const TYPE_STYLE = {
  income: { sign: '+', label: 'Ingreso', cls: 'text-green-700 dark:text-green-400' },
  expense: { sign: '−', label: 'Gasto', cls: 'text-red-700 dark:text-red-400' },
  transfer: { sign: '', label: 'Transferencia', cls: 'text-slate-700 dark:text-slate-300' },
} as const

export function TransactionList({
  rows, onSelect, grouped = true,
}: { rows: Transaction[]; onSelect: (tx: Transaction) => void; grouped?: boolean }) {
  if (!grouped) return <ul className="flex flex-col">{rows.map((t) => <Row key={t.id} tx={t} onSelect={onSelect} />)}</ul>

  const groups: { date: string; items: Transaction[] }[] = []
  for (const t of rows) {
    const last = groups[groups.length - 1]
    if (last?.date === t.date) last.items.push(t)
    else groups.push({ date: t.date, items: [t] })
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <section key={g.date} aria-label={dayLabel(g.date)}>
          <h3 className="mb-1 px-1 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            {dayLabel(g.date)}
          </h3>
          <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            {g.items.map((t) => <Row key={t.id} tx={t} onSelect={onSelect} />)}
          </ul>
        </section>
      ))}
    </div>
  )
}

function Row({ tx, onSelect }: { tx: Transaction; onSelect: (tx: Transaction) => void }) {
  const { accountById, categoryById } = useRefData()
  const cat = tx.category_id ? categoryById.get(tx.category_id) : undefined
  const from = accountById.get(tx.account_id)?.name ?? 'Cuenta'
  const to = tx.to_account_id ? accountById.get(tx.to_account_id)?.name ?? 'Cuenta' : ''
  const style = TYPE_STYLE[tx.type]

  const title = tx.type === 'transfer' ? 'Transferencia' : cat?.name ?? 'Sin categoría'
  const subtitle = [tx.note, tx.type === 'transfer' ? `${from} → ${to}` : from].filter(Boolean).join(' · ')

  return (
    <li className="border-b border-slate-100 last:border-0 dark:border-slate-700">
      <button onClick={() => onSelect(tx)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50">
        <span className="grid size-10 shrink-0 place-items-center rounded-full text-lg" aria-hidden
          style={{ backgroundColor: `${cat?.color ?? '#64748b'}26` }}>
          {tx.type === 'transfer' ? '⇄' : iconFor(cat?.icon)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{title}</span>
          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{subtitle}</span>
          {tx.tags.length > 0 && (
            <span className="mt-1 flex flex-wrap gap-1">
              {tx.tags.map((t) => (
                <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-700 dark:text-slate-300">#{t}</span>
              ))}
            </span>
          )}
        </span>
        <span className={`shrink-0 font-semibold tabular-nums ${style.cls}`}>
          <span className="sr-only">{style.label}: </span>
          {style.sign}{formatCLP(tx.amount)}
        </span>
      </button>
    </li>
  )
}
