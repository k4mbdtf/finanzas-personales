// Inicio / Dashboard: KPIs, alertas de presupuesto, dona de gastos,
// ingresos vs gastos de 12 meses y últimos movimientos del mes seleccionado.
import { Link } from 'react-router-dom'
import { useMonth } from '@/context/Month'
import { useRefData } from '@/context/RefData'
import { listBudgets, spendingByCategory } from '@/data/budgets'
import { monthlyTotals } from '@/data/dashboard'
import { listTransactions } from '@/data/transactions'
import { useQuery } from '@/hooks/useQuery'
import { budgetStatus } from '@/lib/budget'
import { monthLabel, monthRange } from '@/lib/dates'
import { Alert, Button, Card, EmptyState, Spinner } from '@/components/ui'
import { BudgetProgress } from '@/features/budgets/BudgetProgress'
import { TransactionList } from '@/features/transactions/TransactionList'
import { useTransactionDrawer } from '@/features/transactions/TransactionDrawer'
import { IncomeExpenseChart } from './IncomeExpenseChart'
import { Kpis } from './Kpis'
import { SpendingDonut } from './SpendingDonut'

export default function DashboardPage() {
  const { month } = useMonth()
  const { accounts, categoryById, loading } = useRefData()
  const { openNew, openEdit } = useTransactionDrawer()

  const q = useQuery(
    async () => {
      const [totals, spending, budgets, recent] = await Promise.all([
        monthlyTotals(month, 12),
        spendingByCategory(month),
        listBudgets(month),
        listTransactions(monthRange(month), 5),
      ])
      return { totals, spending, budgets, recent: recent.rows }
    },
    [month],
    ['transactions', 'budgets', 'categories'],
  )

  if (loading) return <Spinner label="Cargando…" />

  const active = accounts.filter((a) => !a.archived)
  if (active.length === 0) return <Onboarding />

  if (q.error) return <Alert>{q.error}</Alert>
  if (!q.data) return <Spinner label="Cargando el resumen…" />
  const { totals, spending, budgets, recent } = q.data

  const current = totals[totals.length - 1]
  const previous = totals[totals.length - 2]
  const totalBalance = active.reduce((s, a) => s + a.balance, 0)
  const alerts = budgets
    .map((b) => ({ b, c: categoryById.get(b.category_id), spent: spending.get(b.category_id) ?? 0 }))
    .filter((x) => x.c && budgetStatus(x.spent, x.b.amount).level !== 'ok')
    .sort((x, y) => y.spent / y.b.amount - x.spent / x.b.amount)

  return (
    // Al recargar se mantiene lo anterior con menor opacidad (sin saltos).
    <div className={`flex flex-col gap-5 transition-opacity ${q.loading ? 'opacity-60' : ''}`} aria-busy={q.loading}>
      <h1 className="text-2xl font-bold">Resumen de {monthLabel(month)}</h1>

      <Kpis totalBalance={totalBalance} current={current} previous={previous} />

      {alerts.length > 0 && (
        <section aria-labelledby="alertas">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="alertas" className="text-lg font-semibold">⚠️ Presupuestos en alerta</h2>
            <Link to="/presupuestos" className="text-sm font-medium text-teal-700 underline dark:text-teal-400">Ver todos</Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {alerts.slice(0, 4).map(({ b, c, spent }) => (
              <li key={b.id}><BudgetProgress category={c!} spent={spent} amount={b.amount} /></li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Gastos por categoría</h2>
          <SpendingDonut spending={spending} />
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Ingresos vs gastos · 12 meses</h2>
          <IncomeExpenseChart data={totals} />
        </Card>
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Últimos movimientos</h2>
          <Link to="/movimientos" className="text-sm font-medium text-teal-700 underline dark:text-teal-400">Ver todos</Link>
        </div>
        {recent.length ? (
          <TransactionList rows={recent} onSelect={openEdit} grouped={false} />
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">Aún no hay movimientos en {monthLabel(month)}.</p>
            <Button onClick={() => openNew()}>+ Nueva transacción</Button>
          </div>
        )}
      </Card>
    </div>
  )
}

function Onboarding() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">¡Bienvenido! 👋</h1>
      <EmptyState icon="🚀" title="Empecemos en 3 pasos"
        action={<Link to="/cuentas" className="font-medium text-teal-700 underline dark:text-teal-400">1. Crear mi primera cuenta →</Link>}>
        <ol className="list-decimal space-y-1 pl-5 text-left">
          <li>Crea una cuenta (efectivo, banco, ahorro o tarjeta) con su saldo actual.</li>
          <li>Registra tus movimientos con el botón <strong>+ Nueva transacción</strong>.</li>
          <li>Define presupuestos mensuales y te avisaremos al 80% y al 100%.</li>
        </ol>
        <p className="mt-2">Ya creamos tus categorías por defecto.</p>
      </EmptyState>
    </div>
  )
}
