// Piezas compartidas por la lista de inversiones y su detalle.
import { ArrowDownRight, ArrowUpRight, Equal } from 'lucide-react'
import { formatCLP, formatPct } from '@/lib/format'
import { INVESTMENT_KINDS } from '@/lib/investments'
import { useTransactionDrawer } from '@/features/transactions/TransactionDrawer'
import type { AccountWithBalance } from '@/types'

/** Abre el registro de un aporte o rescate ya completado (transferencias, no gastos). */
export function useInvestmentActions() {
  const { openNew } = useTransactionDrawer()
  return {
    contribute: (a: AccountWithBalance) => openNew({ type: 'transfer', to_account_id: a.id, note: `Aporte ${a.name}` }, 'Aportar'),
    withdraw: (a: AccountWithBalance) => openNew({ type: 'transfer', account_id: a.id, note: `Rescate ${a.name}` }, 'Rescatar'),
  }
}

/** "Fintual · Fondo mutuo" */
export const investmentSubtitle = (a: AccountWithBalance) =>
  [a.counterparty, a.investment_kind && INVESTMENT_KINDS[a.investment_kind]].filter(Boolean).join(' · ')

/** Ganancia o pérdida con flecha, signo y % (nunca solo color). */
export function Gain({ gain, pct, className = '' }: { gain: number; pct: number | null; className?: string }) {
  const Icon = gain > 0 ? ArrowUpRight : gain < 0 ? ArrowDownRight : Equal
  const tone = gain > 0 ? 'text-pos' : gain < 0 ? 'text-neg' : 'text-muted'
  const sign = gain > 0 ? '+' : gain < 0 ? '−' : ''
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1 font-semibold tabular-nums ${tone} ${className}`}>
      <Icon size={15} strokeWidth={2.25} aria-hidden />
      <span className="sr-only">{gain > 0 ? 'Ganancia de' : gain < 0 ? 'Pérdida de' : 'Sin ganancia'} </span>
      {sign}{formatCLP(Math.abs(gain))}
      {pct != null && gain !== 0 && <span className="font-medium">({sign}{formatPct(pct)})</span>}
    </span>
  )
}
