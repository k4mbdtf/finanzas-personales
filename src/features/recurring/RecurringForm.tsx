// Crear / editar un movimiento recurrente.
//  * Al crear: la fecha de inicio puede ser pasada; se generan los movimientos
//    desde ahí hasta hoy (y luego solos cada vez que abres la app).
//  * Al editar: se muestra la "próxima fecha". Si cambias la frecuencia o esa
//    fecha, la regla se reprograma desde ahí (no toca lo ya generado).
import { useMemo, useState, type FormEvent } from 'react'
import { useRefData } from '@/context/RefData'
import { parseTags } from '@/data/transactions'
import { createRule, deleteRule, materializeRecurring, updateRule } from '@/data/recurring'
import { formatDate, todayISO } from '@/lib/format'
import { frequencyLabel, upcoming, type Freq } from '@/lib/recurring'
import { AmountInput } from '@/components/AmountInput'
import { CategoryPicker } from '@/components/CategoryPicker'
import { useConfirm, useToast } from '@/components/Feedback'
import { Alert, Button, Field, Segmented, Select } from '@/components/ui'
import type { RecurringInput, RecurringRule, TxType } from '@/types'

const FREQ_UNIT: Record<Freq, [string, string]> = {
  weekly: ['semana', 'semanas'], monthly: ['mes', 'meses'], yearly: ['año', 'años'],
}

export function RecurringForm({ rule, onDone }: { rule?: RecurringRule; onDone: () => void }) {
  const { accounts, categories } = useRefData()
  const confirm = useConfirm()
  const toast = useToast()
  const usable = accounts.filter((a) => !a.archived || a.id === rule?.account_id || a.id === rule?.to_account_id)
  const firstAccount = usable.find((a) => !a.archived)?.id ?? ''

  const [type, setType] = useState<TxType>(rule?.type ?? 'expense')
  const [amount, setAmount] = useState<number | null>(rule?.amount ?? null)
  const [categoryId, setCategoryId] = useState<string | null>(rule?.category_id ?? null)
  const [accountId, setAccountId] = useState(rule?.account_id ?? firstAccount)
  const [toAccountId, setToAccountId] = useState(rule?.to_account_id ?? usable.find((a) => !a.archived && a.id !== firstAccount)?.id ?? '')
  const [note, setNote] = useState(rule?.note ?? '')
  const [tagsText, setTagsText] = useState(rule?.tags.join(', ') ?? '')
  const [frequency, setFrequency] = useState<Freq>(rule?.frequency ?? 'monthly')
  const [intervalText, setIntervalText] = useState(String(rule?.interval_count ?? 1))
  // En edición la fecha editable es la próxima; al crear, la de inicio.
  const [date, setDate] = useState(rule?.next_date ?? todayISO())
  const [endDate, setEndDate] = useState(rule?.end_date ?? '')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const kindCats = useMemo(
    () => categories.filter((c) => c.kind === type && (!c.archived || c.id === rule?.category_id)),
    [categories, type, rule?.category_id],
  )
  const k = Number(intervalText)
  const validDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d)
  const errors = {
    amount: !amount ? 'Ingresa un monto mayor a $0.' : '',
    category: type !== 'transfer' && !categoryId ? 'Elige una categoría.' : '',
    account: !accountId ? 'Elige una cuenta.' : '',
    toAccount: type === 'transfer' && (!toAccountId || toAccountId === accountId) ? 'Elige una cuenta de destino distinta.' : '',
    interval: !Number.isInteger(k) || k < 1 || k > 12 ? 'Entre 1 y 12.' : '',
    date: !validDate(date) ? 'Ingresa una fecha válida.' : '',
    endDate: endDate && (!validDate(endDate) || endDate < date) ? 'Debe ser posterior a la fecha de inicio.' : '',
  }
  const show = (key: keyof typeof errors) => (submitted ? errors[key] : '')

  const preview = !errors.interval && !errors.date
    ? upcoming({ start_date: date, frequency, interval_count: k, end_date: endDate || null }, 0, 3)
    : []

  function changeType(t: TxType) {
    setType(t)
    const cat = categories.find((c) => c.id === categoryId)
    if (!cat || cat.kind !== t) setCategoryId(null)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (Object.values(errors).some(Boolean)) return
    setError('')
    setBusy(true)
    const base: RecurringInput = {
      type, amount: amount!, account_id: accountId,
      to_account_id: type === 'transfer' ? toAccountId : null,
      category_id: type === 'transfer' ? null : categoryId,
      note: note.trim() || null, tags: parseTags(tagsText),
      frequency, interval_count: k, start_date: date, end_date: endDate || null,
      active: rule?.active ?? true,
    }
    try {
      if (rule) {
        const rescheduled = date !== rule.next_date || frequency !== rule.frequency || k !== rule.interval_count
        // Sin cambios de calendario se conserva el inicio original (y su conteo).
        await updateRule(rule.id, rescheduled
          ? { ...base, occurrence_count: 0 }
          : { ...base, start_date: rule.start_date })
      } else {
        await createRule(base)
      }
      const created = await materializeRecurring()
      toast(created > 0
        ? `Guardado. Se registraron ${created} movimiento${created === 1 ? '' : 's'} hasta hoy`
        : 'Movimiento recurrente guardado')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
      setBusy(false)
    }
  }

  async function onDelete() {
    if (!rule) return
    const ok = await confirm({
      title: 'Eliminar recurrente',
      message: 'Dejará de generar movimientos. Los que ya se registraron se conservan.',
      confirmLabel: 'Eliminar', danger: true,
    })
    if (!ok) return
    try {
      await deleteRule(rule.id)
      toast('Recurrente eliminado')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar.')
    }
  }

  const today = todayISO()

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error && <Alert>{error}</Alert>}

      <Segmented<TxType> label="Tipo" value={type} onChange={changeType}
        options={[
          { value: 'expense', label: '− Gasto', activeClass: 'bg-red-700 text-white shadow-sm' },
          { value: 'income', label: '+ Ingreso', activeClass: 'bg-green-700 text-white shadow-sm' },
          { value: 'transfer', label: '⇄ Transferencia', activeClass: 'bg-slate-700 text-white shadow-sm' },
        ]} />

      <AmountInput label="Monto" value={amount} onChange={setAmount} autoFocus={!rule} big error={show('amount')} />

      <Field label="Descripción" maxLength={500} placeholder="Ej: Arriendo, Sueldo, Netflix"
        value={note} onChange={(e) => setNote(e.target.value)} />

      {type !== 'transfer' && (
        <CategoryPicker categories={kindCats} value={categoryId} onChange={setCategoryId} error={show('category')} />
      )}

      <div className={`grid gap-3 ${type === 'transfer' ? 'grid-cols-2' : ''}`}>
        <Select label={type === 'transfer' ? 'Desde' : 'Cuenta'} value={accountId} error={show('account')}
          onChange={(e) => setAccountId(e.target.value)}>
          {usable.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
        {type === 'transfer' && (
          <Select label="Hacia" value={toAccountId} error={show('toAccount')} onChange={(e) => setToAccountId(e.target.value)}>
            <option value="">Elegir…</option>
            {usable.filter((a) => a.id !== accountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Select label="Frecuencia" value={frequency} onChange={(e) => setFrequency(e.target.value as Freq)}>
          <option value="weekly">Semanal</option>
          <option value="monthly">Mensual</option>
          <option value="yearly">Anual</option>
        </Select>
        <Field label={`Cada cuántos ${FREQ_UNIT[frequency][1]}`} inputMode="numeric" value={intervalText} error={show('interval')}
          onChange={(e) => setIntervalText(e.target.value.replace(/\D/g, '').slice(0, 2))} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={rule ? 'Próxima fecha' : 'Desde'} type="date" value={date} error={show('date')}
          onChange={(e) => setDate(e.target.value)} />
        <Field label="Hasta (opcional)" type="date" value={endDate} min={date} error={show('endDate')}
          onChange={(e) => setEndDate(e.target.value)} />
      </div>

      {preview.length > 0 && (
        <div className="rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-900" aria-live="polite">
          <p className="font-medium">{frequencyLabel(frequency, k, date)}</p>
          <p className="text-slate-600 dark:text-slate-300">Próximas: {preview.map(formatDate).join(' · ')}</p>
          {date < today && (!rule || date !== rule.next_date) && (
            <p className="mt-1 text-amber-800 dark:text-amber-300">
              <span aria-hidden>⚠️ </span>La fecha es pasada: se registrarán los movimientos desde esa fecha hasta hoy.
              Si ya los anotaste a mano, elige la próxima fecha que viene.
            </p>
          )}
        </div>
      )}

      <Field label="Etiquetas (opcional)" placeholder="Ej: casa, suscripción" hint="Sepáralas con comas."
        value={tagsText} onChange={(e) => setTagsText(e.target.value)} />

      <Button type="submit" loading={busy}>{rule ? 'Guardar cambios' : 'Crear recurrente'}</Button>
      {rule && <Button type="button" variant="secondary" onClick={onDelete}>Eliminar recurrente</Button>}
    </form>
  )
}
