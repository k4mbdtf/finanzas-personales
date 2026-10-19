import { useState, type FormEvent } from 'react'
import { deleteBudget, setBudget } from '@/data/budgets'
import { monthLabel } from '@/lib/dates'
import { formatCLP } from '@/lib/format'
import { AmountInput } from '@/components/AmountInput'
import { useConfirm, useToast } from '@/components/Feedback'
import { Alert, Button } from '@/components/ui'
import type { Budget, Category } from '@/types'

export function BudgetForm({
  category, month, budget, spent, onDone,
}: { category: Category; month: string; budget?: Budget; spent: number; onDone: () => void }) {
  const confirm = useConfirm()
  const toast = useToast()
  const [amount, setAmount] = useState<number | null>(budget?.amount ?? null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!amount) return setError('Ingresa un monto mayor a $0.')
    setBusy(true)
    try {
      await setBudget(category.id, month, amount)
      toast('Presupuesto guardado')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
      setBusy(false)
    }
  }

  async function onDelete() {
    if (!budget) return
    const ok = await confirm({
      title: 'Quitar presupuesto',
      message: `¿Quitar el presupuesto de ${category.name} para ${monthLabel(month)}? Los movimientos no se modifican.`,
      confirmLabel: 'Quitar', danger: true,
    })
    if (!ok) return
    try {
      await deleteBudget(budget.id)
      toast('Presupuesto quitado')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo quitar.')
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error && <Alert>{error}</Alert>}
      <p className="text-sm text-slate-600 dark:text-slate-300">
        <strong>{category.name}</strong> · {monthLabel(month)}. Gastado hasta ahora: <strong>{formatCLP(spent)}</strong>.
      </p>
      <AmountInput label="Presupuesto mensual" value={amount} onChange={setAmount} autoFocus big />
      <p className="text-xs text-slate-500 dark:text-slate-400">Te avisaremos al llegar al 80% y al 100%.</p>
      <Button type="submit" loading={busy}>Guardar presupuesto</Button>
      {budget && <Button type="button" variant="secondary" onClick={onDelete}>Quitar presupuesto</Button>}
    </form>
  )
}
