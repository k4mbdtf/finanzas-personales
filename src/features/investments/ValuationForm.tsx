// Actualizar el valor de una inversión: lo que muestra hoy la app del banco o
// la corredora. Desde ahí se calcula la ganancia; los aportes y rescates que
// registres después se suman o restan hasta la próxima actualización.
import { useState, type FormEvent } from 'react'
import { createValuation } from '@/data/investments'
import { formatDate, todayISO } from '@/lib/format'
import { investmentGain } from '@/lib/investments'
import { AmountInput } from '@/components/AmountInput'
import { useToast } from '@/components/Feedback'
import { Alert, Button, Field } from '@/components/ui'
import type { AccountWithBalance, InvestmentStatus } from '@/types'
import { Gain } from './shared'

export function ValuationForm({ investment: a, status, onDone }: {
  investment: AccountWithBalance; status?: InvestmentStatus; onDone: () => void
}) {
  const toast = useToast()
  const [value, setValue] = useState<number | null>(status?.current_value ?? null)
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const errors = {
    value: value == null ? 'Ingresa el valor (puede ser $0).' : '',
    date: !/^\d{4}-\d{2}-\d{2}$/.test(date) ? 'Ingresa una fecha válida.' : date > todayISO() ? 'No puede ser una fecha futura.' : '',
  }
  const show = (k: keyof typeof errors) => (submitted ? errors[k] : '')
  const preview = value != null && status ? investmentGain({ ...status, current_value: value }) : null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (Object.values(errors).some(Boolean)) return
    setError('')
    setBusy(true)
    try {
      await createValuation({ account_id: a.id, date, value: value!, note: note.trim() || null })
      toast('Valor actualizado')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error && <Alert>{error}</Alert>}
      <p className="text-sm text-soft">
        Escribe cuánto vale hoy <strong className="text-ink">{a.name}</strong> en total, como lo muestra la app de tu banco o corredora.
        {status?.valued_at && <> La última vez fue el {formatDate(status.valued_at)}.</>}
      </p>
      <AmountInput label="Valor actual" value={value} onChange={setValue} autoFocus big error={show('value')} />
      {preview && (
        <p className="flex flex-wrap items-center gap-x-2 rounded-sm bg-subtle px-3.5 py-3 text-sm">
          Con este valor: <Gain gain={preview.gain} pct={preview.pct} />
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha" type="date" value={date} max={todayISO()} error={show('date')} onChange={(e) => setDate(e.target.value)} />
        <Field label="Nota (opcional)" maxLength={200} placeholder="Ej: cartola de octubre" value={note}
          onChange={(e) => setNote(e.target.value)} />
      </div>
      <Button type="submit" size="lg" loading={busy}>Guardar valor</Button>
    </form>
  )
}
