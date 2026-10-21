// Campo de monto en cualquier moneda. En pesos es el AmountInput de siempre ($12.500,
// sin decimales); en UF o USD acepta decimales ("1.234,56") y se ordena al salir del campo.
import { useState } from 'react'
import { CURRENCIES, parseMoney, type Currency } from '@/lib/currency'
import { AmountInput } from './AmountInput'
import { Field } from './ui'

const plain = (v: number | null, decimals: number) =>
  v == null ? '' : new Intl.NumberFormat('es-CL', { maximumFractionDigits: decimals }).format(v)

export function MoneyInput({ currency, label, value, onChange, error, hint, autoFocus, big, unit }: {
  currency: Currency
  /** Unidad que se agrega al título; null = ninguna (p. ej. un tipo de cambio). */
  unit?: string | null
  label: string
  value: number | null
  onChange: (v: number | null) => void
  error?: string
  hint?: string
  autoFocus?: boolean
  big?: boolean
}) {
  const decimals = CURRENCIES[currency].decimals
  const [text, setText] = useState(plain(value, decimals))
  const [seen, setSeen] = useState(value)
  // Si el valor cambia desde afuera (p. ej. se calcula con el tipo de cambio), se muestra.
  if (value !== seen) {
    setSeen(value)
    if (value !== parseMoney(text, currency)) setText(plain(value, decimals))
  }

  if (currency === 'CLP') {
    return <AmountInput label={label} value={value} onChange={onChange} error={error} hint={hint} autoFocus={autoFocus} big={big} />
  }
  return (
    <Field
      label={unit === null ? label : `${label} (${unit ?? (currency === 'UF' ? 'UF' : 'US$')})`}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      enterKeyHint="done"
      placeholder="0,00"
      data-autofocus={autoFocus || undefined}
      error={error}
      hint={hint}
      value={text}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d.,]/g, '').slice(0, 18)
        setText(t)
        const v = parseMoney(t, currency)
        setSeen(v)
        onChange(v)
      }}
      onBlur={() => setText(plain(value, decimals))}
      inputClassName={big ? 'min-h-16 text-[2rem] font-bold tracking-[-0.03em] tabular-nums' : 'tabular-nums'}
    />
  )
}
