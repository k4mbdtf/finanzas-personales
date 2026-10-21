// Lista de movimientos agrupada por día. Se reutiliza en Inicio (últimos movimientos).
import { CreditCard, HandCoins, Repeat, Split, TrendingUp, type LucideIcon } from 'lucide-react'
import { useRefData } from '@/context/RefData'
import { currencyOf, formatMoney } from '@/lib/currency'
import { dayLabel } from '@/lib/dates'
import { formatCLP } from '@/lib/format'
import { TRANSFER_LABEL, transferKind, type TransferKind } from '@/lib/accounts'
import { CategoryIcon, IconTile, TransferIcon } from '@/components/icons'
import type { Transaction } from '@/types'

const TYPE_STYLE = {
  income: { sign: '+', label: 'Ingreso', cls: 'text-pos' },
  expense: { sign: '−', label: 'Gasto', cls: 'text-neg' },
  transfer: { sign: '', label: 'Transferencia', cls: 'text-soft' },
} as const

const TRANSFER_ICON: Record<TransferKind, LucideIcon> = {
  card_payment: CreditCard, debt_payment: HandCoins, loan_received: HandCoins, lent: HandCoins,
  collected: HandCoins, contribution: TrendingUp, withdrawal: TrendingUp, transfer: TransferIcon,
}

export function TransactionList({
  rows, onSelect, grouped = true,
}: { rows: Transaction[]; onSelect: (tx: Transaction) => void; grouped?: boolean }) {
  if (!grouped) {
    return <ul className="stagger flex flex-col">{rows.map((t) => <Row key={t.id} tx={t} onSelect={onSelect} />)}</ul>
  }

  const groups: { date: string; items: Transaction[] }[] = []
  for (const t of rows) {
    const last = groups[groups.length - 1]
    if (last?.date === t.date) last.items.push(t)
    else groups.push({ date: t.date, items: [t] })
  }

  return (
    <div className="stagger flex flex-col gap-6">
      {groups.map((g) => (
        <section key={g.date} aria-label={dayLabel(g.date)}>
          <h3 className="label-caps mb-2 px-1">{dayLabel(g.date)}</h3>
          <ul className="card overflow-hidden">
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
  const fromAcc = accountById.get(tx.account_id)
  const toAcc = tx.to_account_id ? accountById.get(tx.to_account_id) : undefined
  const from = fromAcc?.name ?? 'Cuenta'
  const to = toAcc?.name ?? 'Cuenta'
  const style = TYPE_STYLE[tx.type]

  // Pago de deuda o tarjeta, cobro, aporte, rescate... según las cuentas.
  const kind = transferKind(fromAcc?.type, toAcc?.type)
  const title = tx.type === 'transfer' ? TRANSFER_LABEL[kind] : cat?.name ?? 'Sin categoría'
  const subtitle = [tx.note, tx.type === 'transfer' ? `${from} → ${to}` : from].filter(Boolean).join(' · ')

  return (
    <li className="border-b border-line last:border-0">
      <button onClick={() => onSelect(tx)}
        className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors duration-200 hover:bg-subtle/60 active:bg-subtle">
        {tx.type === 'transfer'
          ? <IconTile icon={TRANSFER_ICON[kind]} />
          : <CategoryIcon name={cat?.icon} color={cat?.color} />}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="truncate">{title}</span>
            {tx.recurring_rule_id && (
              <span title="Recurrente" className="shrink-0 text-muted">
                <Repeat size={13} strokeWidth={2} aria-hidden /><span className="sr-only"> (recurrente)</span>
              </span>
            )}
            {tx.split_group && (
              <span title="Parte de un movimiento dividido" className="shrink-0 text-muted">
                <Split size={13} strokeWidth={2} aria-hidden /><span className="sr-only"> (dividido)</span>
              </span>
            )}
          </span>
          <span className="block truncate text-[0.8125rem] text-muted">{subtitle}</span>
          {tx.tags.length > 0 && (
            <span className="mt-1.5 flex flex-wrap gap-1">
              {tx.tags.map((t) => (
                <span key={t} className="rounded-xs bg-subtle px-1.5 py-0.5 text-[11px] font-medium text-soft">#{t}</span>
              ))}
            </span>
          )}
        </span>
        <span className={`shrink-0 text-[0.9375rem] font-semibold tabular-nums ${style.cls}`}>
          <span className="sr-only">{style.label}: </span>
          {/* Cuenta en UF/USD: el monto en su moneda. */}
          {style.sign}{tx.amount_native != null ? formatMoney(Number(tx.amount_native), currencyOf(fromAcc ?? {})) : formatCLP(tx.amount)}
        </span>
      </button>
    </li>
  )
}
