// Campo de monto en CLP: muestra "$12.500" mientras se escribe y entrega un entero.
import { formatCLP, parseCLP } from '@/lib/format'
import { Field } from './ui'

const MAX_DIGITS = 12 // hasta $999.999.999.999

export function AmountInput({
  label, value, onChange, error, autoFocus, big,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  error?: string
  autoFocus?: boolean
  big?: boolean
}) {
  return (
    <Field
      label={label}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      enterKeyHint="done"
      placeholder="$0"
      data-autofocus={autoFocus || undefined}
      error={error}
      value={value == null ? '' : formatCLP(value)}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, MAX_DIGITS)
        onChange(parseCLP(digits))
      }}
      inputClassName={big ? 'min-h-14 text-3xl font-bold tabular-nums' : 'tabular-nums'}
    />
  )
}
