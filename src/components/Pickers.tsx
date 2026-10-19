// Selectores de color e ícono (radio buttons accesibles con aspecto visual).
import { useId } from 'react'
import { CATEGORY_ICONS, COLORS } from '@/lib/icons'

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const name = useId()
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">Color</legend>
      <div className="flex flex-wrap gap-2">
        {COLORS.map((c, i) => (
          <label key={c} className="cursor-pointer">
            <input type="radio" name={name} className="peer sr-only" checked={value === c} onChange={() => onChange(c)} />
            <span
              className="grid size-9 place-items-center rounded-full text-sm text-white ring-offset-2 peer-checked:ring-2 peer-checked:ring-slate-900 peer-focus-visible:ring-2 peer-focus-visible:ring-teal-600 dark:ring-offset-slate-800 dark:peer-checked:ring-white"
              style={{ backgroundColor: c }}
            >
              {value === c ? '✓' : ''}
              <span className="sr-only">Color {i + 1}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function IconPicker({ value, onChange, color }: { value: string; onChange: (i: string) => void; color: string }) {
  const name = useId()
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">Ícono</legend>
      <div className="grid grid-cols-8 gap-1">
        {Object.entries(CATEGORY_ICONS).map(([key, emoji]) => (
          <label key={key} className="cursor-pointer">
            <input type="radio" name={name} className="peer sr-only" checked={value === key} onChange={() => onChange(key)} />
            <span
              className="grid aspect-square place-items-center rounded-lg text-xl peer-checked:ring-2 peer-checked:ring-teal-600 peer-focus-visible:ring-2 peer-focus-visible:ring-teal-600 hover:bg-slate-100 dark:hover:bg-slate-700"
              style={value === key ? { backgroundColor: `${color}33` } : undefined}
            >
              <span aria-hidden>{emoji}</span>
              <span className="sr-only">{key}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
