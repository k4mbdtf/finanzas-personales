import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMonth } from '@/context/Month'
import { useRefData } from '@/context/RefData'
import { copyBudgets, listBudgets, spendingByCategory } from '@/data/budgets'
import { useQuery } from '@/hooks/useQuery'
import { budgetStatus, LEVEL_UI } from '@/lib/budget'
import { addMonths, monthLabel } from '@/lib/dates'
import { formatCLP } from '@/lib/format'
import { iconFor } from '@/lib/icons'
import { useToast } from '@/components/Feedback'
import { Modal } from '@/components/Modal'
import { Alert, Button, Card, EmptyState, Spinner } from '@/components/ui'
import type { Category } from '@/types'
import { BudgetForm } from './BudgetForm'
import { BudgetProgress } from './BudgetProgress'

export default function BudgetsPage() {
  const { month } = useMonth()
  const { categories, categoryById } = useRefData()
  const toast = useToast()
  const [editing, setEditing] = useState<Category | null>(null)
  const [copying, setCopying] = useState(false)

  const q = useQuery(
    async () => {
      const [budgets, spending, prev] = await Promise.all([
        listBudgets(month), spendingByCategory(month), listBudgets(addMonths(month, -1)),
      ])
      return { budgets, spending, prevCount: prev.length }
    },
    [month],
    ['budgets', 'transactions', 'categories'],
  )

  if (q.loading && !q.data) return <Spinner label="Cargando presupuestos…" />
  if (q.error) return <Alert>{q.error}</Alert>
  const { budgets, spending, prevCount } = q.data!

  const spentOf = (id: string) => spending.get(id) ?? 0
  const rows = budgets
    .map((b) => ({ budget: b, category: categoryById.get(b.category_id)!, spent: spentOf(b.category_id) }))
    .filter((r) => r.category)
    .sort((a, b) => b.spent / b.budget.amount - a.spent / a.budget.amount)

  const budgetedIds = new Set(budgets.map((b) => b.category_id))
  const unbudgeted = categories
    .filter((c) => c.kind === 'expense' && !c.archived && !budgetedIds.has(c.id))
    .sort((a, b) => spentOf(b.id) - spentOf(a.id))

  const totalBudget = rows.reduce((s, r) => s + r.budget.amount, 0)
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0)
  const overall = budgetStatus(totalSpent, totalBudget)
  const warn = rows.filter((r) => budgetStatus(r.spent, r.budget.amount).level === 'warn')
  const over = rows.filter((r) => budgetStatus(r.spent, r.budget.amount).level === 'over')

  async function onCopy() {
    setCopying(true)
    try {
      const n = await copyBudgets(addMonths(month, -1), month)
      toast(`${n} presupuesto${n === 1 ? '' : 's'} copiado${n === 1 ? '' : 's'}`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo copiar', 'error')
    }
    setCopying(false)
  }

  const editingBudget = editing ? budgets.find((b) => b.category_id === editing.id) : undefined

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Presupuestos</h1>
        <Link to="/categorias" className="text-sm font-medium text-teal-700 underline dark:text-teal-400">Categorías</Link>
      </div>

      {(over.length > 0 || warn.length > 0) && (
        <div role="alert" className="flex flex-col gap-1 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          {over.length > 0 && <p>⛔ <strong>Excedidos:</strong> {over.map((r) => r.category.name).join(', ')}</p>}
          {warn.length > 0 && <p>⚠️ <strong>Sobre el 80%:</strong> {warn.map((r) => r.category.name).join(', ')}</p>}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState icon="🎯" title={`Sin presupuestos en ${monthLabel(month)}`}
          action={prevCount > 0 && (
            <Button onClick={onCopy} loading={copying}>Copiar {prevCount} del mes anterior</Button>
          )}>
          Define cuánto quieres gastar como máximo en cada categoría. Te avisaremos al llegar al 80% y al 100%.
          {unbudgeted.length > 0 && ' Elige una categoría de la lista de abajo para empezar.'}
        </EmptyState>
      ) : (
        <>
          <Card>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><p className="text-xs text-slate-500 dark:text-slate-400">Presupuestado</p><p className="font-bold tabular-nums">{formatCLP(totalBudget)}</p></div>
              <div><p className="text-xs text-slate-500 dark:text-slate-400">Gastado</p><p className="font-bold text-red-700 tabular-nums dark:text-red-400">{formatCLP(totalSpent)}</p></div>
              <div><p className="text-xs text-slate-500 dark:text-slate-400">{totalBudget >= totalSpent ? 'Disponible' : 'Excedido'}</p><p className="font-bold tabular-nums">{formatCLP(Math.abs(totalBudget - totalSpent))}</p></div>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar"
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(overall.pct, 100)} aria-label={`Total: ${overall.pct}% usado`}>
              <div className={`h-full rounded-full ${LEVEL_UI[overall.level].bar}`} style={{ width: `${Math.min(overall.pct, 100)}%` }} />
            </div>
            <p className={`mt-1 text-center text-xs font-medium ${LEVEL_UI[overall.level].text}`}>{overall.pct}% del total · {LEVEL_UI[overall.level].label}</p>
          </Card>

          <ul className="grid gap-3 sm:grid-cols-2">
            {rows.map((r) => (
              <li key={r.budget.id}>
                <BudgetProgress category={r.category} spent={r.spent} amount={r.budget.amount} onClick={() => setEditing(r.category)} />
              </li>
            ))}
          </ul>
        </>
      )}

      {unbudgeted.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Sin presupuesto</h2>
          <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            {unbudgeted.map((c) => (
              <li key={c.id} className="border-b border-slate-100 last:border-0 dark:border-slate-700">
                <button onClick={() => setEditing(c)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <span className="grid size-9 place-items-center rounded-full" style={{ backgroundColor: `${c.color}33` }} aria-hidden>{iconFor(c.icon)}</span>
                  <span className="flex-1">
                    <span className="block font-medium">{c.name}</span>
                    <span className="block text-xs text-slate-500 tabular-nums dark:text-slate-400">Gastado: {formatCLP(spentOf(c.id))}</span>
                  </span>
                  <span className="text-sm font-medium text-teal-700 dark:text-teal-400">+ Definir</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editingBudget ? 'Editar presupuesto' : 'Nuevo presupuesto'}>
        {editing && (
          <BudgetForm category={editing} month={month} budget={editingBudget}
            spent={spentOf(editing.id)} onDone={() => setEditing(null)} />
        )}
      </Modal>
    </div>
  )
}
