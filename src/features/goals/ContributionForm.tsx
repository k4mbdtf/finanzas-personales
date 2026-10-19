// Abonar o retirar de una meta (manual) + historial de abonos.
import { useState, type FormEvent } from 'react'
import { addContribution, deleteContribution, listContributions } from '@/data/goals'
import { useQuery } from '@/hooks/useQuery'
import { formatCLP, formatDate, todayISO } from '@/lib/format'
import { AmountInput } from '@/components/AmountInput'
import { useConfirm, useToast } from '@/components/Feedback'
import { Alert, Button, Field, Segmented, Spinner } from '@/components/ui'
import type { GoalWithProgress } from '@/types'

export function ContributionForm({ goal, onDone }: { goal: GoalWithProgress; onDone: () => void }) {
  const confirm = useConfirm()
  const toast = useToast()
  const history = useQuery(() => listContributions(goal.id), [goal.id], ['goals'])
  const [kind, setKind] = useState<'in' | 'out'>('in')
  const [amount, setAmount] = useState<number | null>(null)
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!amount) return setError('Ingresa un monto mayor a $0.')
    if (kind === 'out' && amount > goal.saved) return setError(`No puedes retirar más de lo ahorrado (${formatCLP(goal.saved)}).`)
    setError('')
    setBusy(true)
    try {
      await addContribution(goal.id, kind === 'in' ? amount : -amount, date, note.trim() || null)
      toast(kind === 'in' ? 'Abono registrado' : 'Retiro registrado')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
      setBusy(false)
    }
  }

  async function remove(id: string) {
    const ok = await confirm({ title: 'Eliminar registro', message: '¿Eliminar este abono o retiro?', confirmLabel: 'Eliminar', danger: true })
    if (!ok) return
    try {
      await deleteContribution(id)
      toast('Registro eliminado')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo eliminar', 'error')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <Segmented<'in' | 'out'> label="Tipo" value={kind} onChange={setKind}
          options={[{ value: 'in', label: '+ Abonar' }, { value: 'out', label: '− Retirar' }]} />
        <AmountInput label="Monto" value={amount} onChange={setAmount} autoFocus big />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Field label="Nota (opcional)" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <Button type="submit" loading={busy}>{kind === 'in' ? 'Registrar abono' : 'Registrar retiro'}</Button>
      </form>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">Historial</h3>
        {history.loading && !history.data ? <Spinner /> : !history.data?.length ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Aún no hay abonos.</p>
        ) : (
          <ul className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
            {history.data.map((c) => (
              <li key={c.id} className="flex items-center gap-3 border-b border-slate-100 px-3 py-2 text-sm last:border-0 dark:border-slate-700">
                <span className="flex-1">
                  <span className="block">{formatDate(c.date)}</span>
                  {c.note && <span className="block text-xs text-slate-500 dark:text-slate-400">{c.note}</span>}
                </span>
                <span className={`font-semibold tabular-nums ${c.amount < 0 ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
                  {c.amount < 0 ? '−' : '+'}{formatCLP(Math.abs(c.amount))}
                </span>
                <button onClick={() => remove(c.id)} className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                  aria-label={`Eliminar registro del ${formatDate(c.date)}`}>✕</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
