// Grilla de categorías para elegir con un toque. Se usa en movimientos,
// recurrentes y compras en cuotas.
import { Ban } from 'lucide-react'
import type { Category } from '@/types'
import { CategoryIcon } from './icons'

export function CategoryPicker({
  categories, value, onChange, error, label = 'Categoría', allowNone,
}: {
  categories: Category[]
  value: string | null
  onChange: (id: string | null) => void
  error?: string
  label?: string
  /** Muestra la opción "Sin categoría". */
  allowNone?: boolean
}) {
  const chip = (active: boolean) =>
    `pressable flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-sm border px-1 py-2 text-xs font-medium transition-colors duration-200 ${
      active ? 'border-ink bg-subtle text-ink' : 'border-line bg-surface text-soft hover:border-line-strong/50 hover:text-ink'}`

  return (
    <fieldset>
      <legend className="mb-1.5 text-[0.8125rem] font-medium text-soft">{label}</legend>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {allowNone && (
          <button type="button" aria-pressed={value === null} onClick={() => onChange(null)} className={chip(value === null)}>
            <span className="grid size-8 place-items-center rounded-lg bg-subtle text-muted" aria-hidden><Ban size={16} strokeWidth={1.75} /></span>
            <span>Sin categoría</span>
          </button>
        )}
        {categories.map((c) => (
          <button key={c.id} type="button" aria-pressed={c.id === value} onClick={() => onChange(c.id)} className={chip(c.id === value)}>
            <CategoryIcon name={c.icon} color={c.color} size="sm" />
            <span className="line-clamp-1">{c.name}</span>
          </button>
        ))}
      </div>
      {error && <p className="mt-1.5 text-sm text-neg">{error}</p>}
    </fieldset>
  )
}
