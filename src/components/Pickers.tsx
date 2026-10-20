// Selectores de color e ícono (radio buttons accesibles con aspecto visual).
import { useId } from 'react'
import { Check } from 'lucide-react'
import { CATEGORY_ICONS, COLORS } from '@/lib/icons'
import { categoryIcon } from './icons'

const legendCls = 'mb-1.5 text-[0.8125rem] font-medium text-soft'

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const name = useId()
  // Si el color guardado no está en la paleta (colores antiguos), se muestra igual.
  const colors = COLORS.includes(value) ? COLORS : [value, ...COLORS]
  return (
    <fieldset>
      <legend className={legendCls}>Color</legend>
      <div className="flex flex-wrap gap-2">
        {colors.map((c, i) => (
          <label key={c} className="cursor-pointer">
            <input type="radio" name={name} className="peer sr-only" checked={value === c} onChange={() => onChange(c)} />
            <span
              className="pressable grid size-9 place-items-center rounded-sm text-white ring-offset-2 ring-offset-surface
                peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-ink"
              style={{ backgroundColor: c }}
            >
              {value === c && <Check size={16} strokeWidth={2.5} aria-hidden />}
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
      <legend className={legendCls}>Ícono</legend>
      <div className="grid grid-cols-8 gap-1.5">
        {Object.entries(CATEGORY_ICONS).map(([key, label]) => {
          const Icon = categoryIcon(key)
          const active = value === key
          return (
            <label key={key} className="cursor-pointer" title={label}>
              <input type="radio" name={name} className="peer sr-only" checked={active} onChange={() => onChange(key)} />
              <span
                className={`pressable grid aspect-square place-items-center rounded-sm border transition-colors duration-200
                  peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink
                  ${active ? 'border-ink' : 'border-transparent text-soft hover:bg-subtle'}`}
                style={active ? {
                  backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
                  color: `color-mix(in srgb, ${color} 72%, var(--icon-mix))`,
                } : undefined}
              >
                <Icon size={20} strokeWidth={1.75} aria-hidden />
                <span className="sr-only">{label}</span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
