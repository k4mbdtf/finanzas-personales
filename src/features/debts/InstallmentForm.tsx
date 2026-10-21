// Nueva compra en cuotas (o editar descripción/categoría de una existente).
// Al crear, la BD genera todas las cuotas (una por mes) en la tarjeta.
import { useState, type FormEvent } from 'react'
import { useRefData } from '@/context/RefData'
import { inPesos } from '@/lib/currency'
import { createPlan, deletePlan, updatePlan, type PlanWithStatus } from '@/data/installments'
import { formatCLP, formatDate, todayISO } from '@/lib/format'
import { CalendarClock, Trash2 } from 'lucide-react'
import { AmountInput } from '@/components/AmountInput'
import { CategoryPicker } from '@/components/CategoryPicker'
import { useConfirm, useToast } from '@/components/Feedback'
import { Alert, Button, Checkbox, Field, Select } from '@/components/ui'

const QUICK_COUNTS = [3, 6, 12, 24]

export function InstallmentForm({ plan, onDone }: { plan?: PlanWithStatus; onDone: () => void }) {
  const { accounts, categories } = useRefData()
  const confirm = useConfirm()
  const toast = useToast()
  // Solo tarjetas en pesos (las cuotas se registran en pesos).
  const cards = accounts.filter((a) => a.type === 'credit_card' && inPesos(a) && (!a.archived || a.id === plan?.account_id))
  const expenseCats = categories.filter((c) => c.kind === 'expense' && (!c.archived || c.id === plan?.category_id))

  const [description, setDescription] = useState(plan?.description ?? '')
  const [accountId, setAccountId] = useState(plan?.account_id ?? cards.find((c) => !c.archived)?.id ?? '')
  const [categoryId, setCategoryId] = useState<string | null>(plan?.category_id ?? null)
  const [total, setTotal] = useState<number | null>(null)
  const [count, setCount] = useState('3')
  const [withInterest, setWithInterest] = useState(false)
  const [cuota, setCuota] = useState<number | null>(null)
  const [firstDate, setFirstDate] = useState(todayISO())
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const n = Number(count)
  const errors = {
    description: !description.trim() ? 'Describe la compra (ej: Televisor).' : '',
    account: !accountId ? 'Elige la tarjeta.' : '',
    count: !Number.isInteger(n) || n < 2 || n > 60 ? 'Entre 2 y 60 cuotas.' : '',
    amount: withInterest
      ? (!cuota ? 'Ingresa el valor de cada cuota.' : '')
      : (!total ? 'Ingresa el monto total.' : total < n ? 'El total debe ser mayor que el número de cuotas.' : ''),
    date: !/^\d{4}-\d{2}-\d{2}$/.test(firstDate) ? 'Ingresa una fecha válida.' : '',
  }
  const show = (k: keyof typeof errors) => (submitted ? errors[k] : '')

  // Vista previa igual al cálculo de la BD: cuotas iguales y la última absorbe el redondeo.
  const preview = (() => {
    if (errors.count) return ''
    if (withInterest && cuota) return `${n} cuotas de ${formatCLP(cuota)} = ${formatCLP(cuota * n)} en total`
    if (!withInterest && total && total >= n) {
      const each = Math.floor(total / n)
      const last = total - each * (n - 1)
      return last === each ? `${n} cuotas de ${formatCLP(each)}` : `${n - 1} cuotas de ${formatCLP(each)} y la última de ${formatCLP(last)}`
    }
    return ''
  })()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    const relevant = plan ? [errors.description] : Object.values(errors)
    if (relevant.some(Boolean)) return
    setError('')
    setBusy(true)
    try {
      if (plan) {
        await updatePlan(plan.id, { description: description.trim(), category_id: categoryId })
        toast('Compra actualizada')
      } else {
        await createPlan({
          description: description.trim(), accountId, categoryId,
          total: withInterest ? null : total, count: n, firstDate,
          installmentAmount: withInterest ? cuota : null,
        })
        toast(`Compra en ${n} cuotas registrada`)
      }
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
      setBusy(false)
    }
  }

  async function onDelete() {
    if (!plan) return
    const ok = await confirm({
      title: 'Eliminar compra en cuotas',
      message: <>Se eliminarán las <strong>{plan.installments_count} cuotas</strong> de "{plan.description}",
        incluidas las que ya pasaron. Esta acción no se puede deshacer.</>,
      confirmLabel: 'Eliminar', danger: true,
    })
    if (!ok) return
    try {
      await deletePlan(plan.id)
      toast('Compra eliminada')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar.')
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error && <Alert>{error}</Alert>}

      <Field label="¿Qué compraste?" maxLength={80} data-autofocus={!plan || undefined} placeholder="Ej: Televisor"
        value={description} error={show('description')} onChange={(e) => setDescription(e.target.value)} />

      {plan ? (
        <Alert kind="info">
          {plan.installments_count} cuotas de {formatCLP(plan.installment_amount)} · total {formatCLP(plan.total_amount)} ·
          primera el {formatDate(plan.first_date)}. Para cambiar montos, cuotas o tarjeta, elimina la compra y créala de nuevo.
        </Alert>
      ) : (
        <>
          <Select label="Tarjeta de crédito" value={accountId} error={show('account')} onChange={(e) => setAccountId(e.target.value)}>
            {cards.filter((c) => !c.archived).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>

          <div className="flex flex-col gap-2">
            <Field label="Número de cuotas" inputMode="numeric" value={count} error={show('count')}
              onChange={(e) => setCount(e.target.value.replace(/\D/g, '').slice(0, 2))} />
            <div className="flex gap-2">
              {QUICK_COUNTS.map((q) => (
                <button key={q} type="button" aria-pressed={n === q} onClick={() => setCount(String(q))}
                  className={`pressable min-h-9 min-w-12 rounded-sm border px-3 text-sm font-semibold tabular-nums transition-colors duration-200 ${n === q
                    ? 'border-accent bg-accent text-on-accent'
                    : 'border-line-strong/45 bg-surface text-ink hover:bg-subtle'}`}>
                  {q}
                </button>
              ))}
            </div>
          </div>

          <Checkbox label="Tiene interés" hint="Usa esta opción si conoces el valor fijo de cada cuota."
            checked={withInterest} onChange={setWithInterest} />
          {withInterest
            ? <AmountInput label="Valor de cada cuota" value={cuota} onChange={setCuota} error={show('amount')} big />
            : <AmountInput label="Monto total de la compra" value={total} onChange={setTotal} error={show('amount')} big />}

          <Field label="Fecha de la primera cuota" type="date" value={firstDate} error={show('date')}
            hint="Normalmente la fecha de la compra o la de tu próxima facturación."
            onChange={(e) => setFirstDate(e.target.value)} />

          {preview && (
            <p key={preview} className="animate-fade flex items-center gap-2 rounded-sm bg-subtle px-3.5 py-3 text-sm font-medium" aria-live="polite">
              <CalendarClock size={17} strokeWidth={2} className="shrink-0 text-muted" aria-hidden />{preview}
            </p>
          )}
        </>
      )}

      <CategoryPicker categories={expenseCats} value={categoryId} onChange={setCategoryId} allowNone />

      {!plan && (
        <p className="text-xs text-muted">
          El cupo de la tarjeta se descuenta completo hoy, y cada cuota cuenta como gasto en su mes (presupuestos y resumen).
        </p>
      )}

      <Button type="submit" size="lg" loading={busy}>{plan ? 'Guardar cambios' : 'Registrar compra en cuotas'}</Button>
      {plan && <Button type="button" variant="ghost" icon={Trash2} className="text-neg" onClick={onDelete}>Eliminar compra y sus cuotas</Button>}
    </form>
  )
}
