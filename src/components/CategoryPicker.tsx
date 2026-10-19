// Grilla de categorías para elegir con un toque. Se usa en movimientos,
// recurrentes y compras en cuotas.
import { iconFor } from '@/lib/icons'
import type { Category } from '@/types'

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
    `flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-xs font-medium ${
      active
        ? 'border-transparent ring-2 ring-teal-600'
        : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700'}`

  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">{label}</legend>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {allowNone && (
          <button type="button" aria-pressed={value === null} onClick={() => onChange(null)} className={chip(value === null)}>
            <span className="text-xl" aria-hidden>∅</span>
            <span>Sin categoría</span>
          </button>
        )}
        {categories.map((c) => {
          const active = c.id === value
          return (
            <button key={c.id} type="button" aria-pressed={active} onClick={() => onChange(c.id)}
              className={chip(active)} style={active ? { backgroundColor: `${c.color}26` } : undefined}>
              <span className="text-xl" aria-hidden>{iconFor(c.icon)}</span>
              <span className="line-clamp-1">{c.name}</span>
            </button>
          )
        })}
      </div>
      {error && <p className="mt-1 text-sm text-red-700 dark:text-red-400">{error}</p>}
    </fieldset>
  )
}
