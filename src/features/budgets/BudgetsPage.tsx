import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMonth } from '@/context/Month'
import { useRefData } from '@/context/RefData'
import { copyBudgets, listBudgets, spendingByCategory } from '@/data/budgets'
import { useQuery } from '@/hooks/useQuery'
import { budgetStatus, LEVEL_UI } from '@/lib/budget'
import { addMonths, monthLabel } from '@/lib/dates'
import { formatCLP } from '@/lib/format'
import { Copy, OctagonAlert, Plus, Tags, Target, TriangleAlert } from 'lucide-react'
import { useToast } from '@/components/Feedback'
import { CategoryIcon } from '@/components/icons'
import { Modal } from '@/components/Modal'
import { ProgressBar } from '@/components/ProgressBar'
import { Alert, Button, Card, EmptyState, Loading, PageHeader, SectionHeader } from '@/components/ui'
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

  if (q.loading && !q.data) return <Loading label="Cargando presupuestos…" />
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
    <div className="flex flex-col gap-8">
      <PageHeader title="Presupuestos" subtitle={monthLabel(month)}
        action={<Link to="/categorias" className="link inline-flex items-center gap-1.5 text-sm"><Tags size={16} strokeWidth={2} aria-hidden />Categorías</Link>} />

      {(over.length > 0 || warn.length > 0) && (
        <div role="alert" className="animate-fade flex flex-col gap-2 rounded-sm border border-warn/30 bg-warn-soft px-3.5 py-3 text-sm text-ink">
          {over.length > 0 && (
            <p className="flex items-start gap-2"><OctagonAlert size={17} strokeWidth={2} className="mt-px shrink-0 text-neg" aria-hidden />
              <span><strong>Excedidos:</strong> {over.map((r) => r.category.name).join(', ')}</span></p>
          )}
          {warn.length > 0 && (
            <p className="flex items-start gap-2"><TriangleAlert size={17} strokeWidth={2} className="mt-px shrink-0 text-warn" aria-hidden />
              <span><strong>Sobre el 80%:</strong> {warn.map((r) => r.category.name).join(', ')}</span></p>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={Target} title={`Sin presupuestos en ${monthLabel(month)}`}
          action={prevCount > 0 && (
            <Button icon={Copy} onClick={onCopy} loading={copying}>Copiar {prevCount} del mes anterior</Button>
          )}>
          Define cuánto quieres gastar como máximo en cada categoría. Te avisaremos al llegar al 80% y al 100%.
          {unbudgeted.length > 0 && ' Elige una categoría de la lista de abajo para empezar.'}
        </EmptyState>
      ) : (
        <>
          <Card>
            <div className="grid grid-cols-3 gap-3">
              <div><p className="label-caps">Presupuestado</p><p className="figure-hero mt-1 text-lg sm:text-xl">{formatCLP(totalBudget)}</p></div>
              <div><p className="label-caps">Gastado</p><p className="figure-hero mt-1 text-lg text-neg sm:text-xl">{formatCLP(totalSpent)}</p></div>
              <div><p className="label-caps">{totalBudget >= totalSpent ? 'Disponible' : 'Excedido'}</p><p className="figure-hero mt-1 text-lg sm:text-xl">{formatCLP(Math.abs(totalBudget - totalSpent))}</p></div>
            </div>
            <div className="mt-5">
              <ProgressBar pct={overall.pct} label={`Total: ${overall.pct}% usado`} barClass={LEVEL_UI[overall.level].bar} thick />
            </div>
            <p className={`mt-2 text-xs font-medium ${LEVEL_UI[overall.level].text}`}>{overall.pct}% del total · {LEVEL_UI[overall.level].label}</p>
          </Card>

          <ul className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          <SectionHeader title="Sin presupuesto" />
          <ul className="card overflow-hidden">
            {unbudgeted.map((c) => (
              <li key={c.id} className="border-b border-line last:border-0">
                <button onClick={() => setEditing(c)}
                  className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors duration-200 hover:bg-subtle/60 active:bg-subtle">
                  <CategoryIcon name={c.icon} color={c.color} />
                  <span className="flex-1">
                    <span className="block font-medium">{c.name}</span>
                    <span className="block text-[0.8125rem] text-muted tabular-nums">Gastado: {formatCLP(spentOf(c.id))}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-ink"><Plus size={16} strokeWidth={2.25} aria-hidden />Definir</span>
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
