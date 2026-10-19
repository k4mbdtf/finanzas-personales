// Crear / editar una meta de ahorro.
// Opcional: vincularla a una cuenta (el avance = saldo de esa cuenta).
import { useState, type FormEvent } from 'react'
import { useRefData } from '@/context/RefData'
import { createGoal, deleteGoal, updateGoal } from '@/data/goals'
import { COLORS, isLiability } from '@/lib/icons'
import { AmountInput } from '@/components/AmountInput'
import { useConfirm, useToast } from '@/components/Feedback'
import { ColorPicker, IconPicker } from '@/components/Pickers'
import { Alert, Button, Field, Select } from '@/components/ui'
import type { Goal } from '@/types'

export function GoalForm({ goal, onDone }: { goal?: Goal; onDone: () => void }) {
  const { accounts } = useRefData()
  const confirm = useConfirm()
  const toast = useToast()
  // Solo cuentas de activo (no tarjetas ni préstamos).
  const linkable = accounts.filter((a) => !isLiability(a.type) && (!a.archived || a.id === goal?.account_id))

  const [name, setName] = useState(goal?.name ?? '')
  const [target, setTarget] = useState<number | null>(goal?.target_amount ?? null)
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? '')
  const [accountId, setAccountId] = useState(goal?.account_id ?? '')
  const [icon, setIcon] = useState(goal?.icon ?? 'piggy-bank')
  const [color, setColor] = useState(goal?.color ?? COLORS[0])
  const [archived, setArchived] = useState(goal?.archived ?? false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const errors = {
    name: !name.trim() ? 'Ponle un nombre a la meta.' : '',
    target: !target ? 'Ingresa cuánto quieres ahorrar.' : '',
  }
  const show = (k: keyof typeof errors) => (submitted ? errors[k] : '')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (Object.values(errors).some(Boolean)) return
    setError('')
    setBusy(true)
    const input = {
      name: name.trim(), target_amount: target!, target_date: targetDate || null,
      account_id: accountId || null, icon, color, archived,
    }
    try {
      if (goal) await updateGoal(goal.id, input)
      else await createGoal(input)
      toast(goal ? 'Meta actualizada' : 'Meta creada')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
      setBusy(false)
    }
  }

  async function onDelete() {
    if (!goal) return
    const ok = await confirm({
      title: 'Eliminar meta',
      message: <>¿Eliminar <strong>{goal.name}</strong> y su historial de abonos? Tus cuentas y movimientos no cambian.</>,
      confirmLabel: 'Eliminar', danger: true,
    })
    if (!ok) return
    try {
      await deleteGoal(goal.id)
      toast('Meta eliminada')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar.')
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error && <Alert>{error}</Alert>}
      <Field label="¿Para qué ahorras?" maxLength={60} data-autofocus={!goal || undefined}
        placeholder="Ej: Vacaciones, Fondo de emergencia" value={name} error={show('name')}
        onChange={(e) => setName(e.target.value)} />
      <AmountInput label="Monto objetivo" value={target} onChange={setTarget} error={show('target')} big />
      <Field label="Fecha objetivo (opcional)" type="date" value={targetDate}
        hint="Te diremos cuánto ahorrar cada mes para llegar." onChange={(e) => setTargetDate(e.target.value)} />
      <Select label="¿Cómo medir el avance?" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
        <option value="">Con abonos manuales</option>
        {linkable.map((a) => <option key={a.id} value={a.id}>Saldo de la cuenta: {a.name}</option>)}
      </Select>
      <p className="-mt-2 text-xs text-slate-500 dark:text-slate-400">
        {accountId
          ? 'El avance será el saldo actual de esa cuenta (ideal para una cuenta de ahorro dedicada).'
          : 'Registrarás abonos y retiros a mano. Son solo un registro: no mueven dinero entre tus cuentas.'}
      </p>
      <IconPicker value={icon} onChange={setIcon} color={color} />
      <ColorPicker value={color} onChange={setColor} />
      {goal && (
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" className="size-4" checked={archived} onChange={(e) => setArchived(e.target.checked)} />
          Archivar meta
        </label>
      )}
      <Button type="submit" loading={busy}>{goal ? 'Guardar cambios' : 'Crear meta'}</Button>
      {goal && <Button type="button" variant="secondary" onClick={onDelete}>Eliminar meta</Button>}
    </form>
  )
}
