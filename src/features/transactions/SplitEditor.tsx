// Partes de un movimiento dividido: una categoría y un monto por fila, con lo que
// falta (o sobra) por repartir siempre a la vista.
import { Plus, X } from 'lucide-react'
import { formatCLP, parseCLP } from '@/lib/format'
import { nextPart, splitStatus, type DraftPart } from '@/lib/split'
import type { Category } from '@/types'

const MAX_PARTS = 20

export function SplitEditor({ total, parts, onChange, categories, showError }: {
  total: number | null
  parts: DraftPart[]
  onChange: (parts: DraftPart[]) => void
  categories: Category[]
  showError: boolean
}) {
  const status = splitStatus(total, parts)
  const set = (i: number, patch: Partial<DraftPart>) => onChange(parts.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  const inputCls = 'min-h-11 w-full rounded-sm border border-line-strong/45 bg-surface px-3 text-[0.9375rem] focus:border-ink focus:outline-none focus:ring-4 focus:ring-ink/10'

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-[0.8125rem] font-medium text-soft">Dividir entre categorías</legend>
      <ul className="flex flex-col gap-2">
        {parts.map((p, i) => (
          <li key={i} className="grid grid-cols-[1fr_8.5rem_auto] items-center gap-2">
            <select aria-label={`Categoría de la parte ${i + 1}`} value={p.categoryId ?? ''}
              onChange={(e) => set(i, { categoryId: e.target.value || null })} className={inputCls}>
              <option value="">Categoría…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input aria-label={`Monto de la parte ${i + 1}`} inputMode="numeric" autoComplete="off" placeholder="$0"
              value={p.amount == null ? '' : formatCLP(p.amount)}
              onChange={(e) => set(i, { amount: parseCLP(e.target.value.replace(/\D/g, '').slice(0, 12)) })}
              className={`${inputCls} text-right tabular-nums`} />
            <button type="button" onClick={() => onChange(parts.filter((_, j) => j !== i))} disabled={parts.length <= 2}
              aria-label={`Quitar la parte ${i + 1}`}
              className="pressable grid size-9 place-items-center rounded-full text-muted hover:bg-subtle hover:text-ink disabled:invisible">
              <X size={16} strokeWidth={2} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => onChange([...parts, nextPart(total, parts)])} disabled={parts.length >= MAX_PARTS}
          className="pressable inline-flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-sm font-semibold text-soft hover:bg-subtle hover:text-ink">
          <Plus size={16} strokeWidth={2} aria-hidden /> Agregar parte
        </button>
        <p className={`text-sm tabular-nums ${status.remaining === 0 ? 'text-muted' : 'font-medium text-warn'}`} aria-live="polite">
          {status.remaining === 0 ? `Repartido ${formatCLP(status.assigned)}`
            : status.remaining > 0 ? `Falta repartir ${formatCLP(status.remaining)}`
            : `Sobran ${formatCLP(-status.remaining)}`}
        </p>
      </div>
      {showError && status.error && <p className="text-sm font-medium text-neg">{status.error}</p>}
    </fieldset>
  )
}
