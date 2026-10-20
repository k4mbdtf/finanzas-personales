// Inicio / Dashboard: KPIs, alertas de presupuesto, dona de gastos,
// próximos pagos, ingresos vs gastos de 12 meses y últimos movimientos del mes seleccionado.
import { lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Plus, Rocket, TriangleAlert } from 'lucide-react'
import { useMonth } from '@/context/Month'
import { useRefData } from '@/context/RefData'
import { listBudgets, spendingByCategory } from '@/data/budgets'
import { monthlyTotals } from '@/data/dashboard'
import { listTransactions } from '@/data/transactions'
import { useQuery } from '@/hooks/useQuery'
import { budgetStatus } from '@/lib/budget'
import { monthLabel, monthRange } from '@/lib/dates'
import { Alert, Button, Card, EmptyState, PageHeader, SectionHeader, buttonLinkCls } from '@/components/ui'
import { BudgetProgress } from '@/features/budgets/BudgetProgress'
import { TransactionList } from '@/features/transactions/TransactionList'
import { useTransactionDrawer } from '@/features/transactions/TransactionDrawer'
import { Kpis } from './Kpis'
import { UpcomingPayments } from './UpcomingPayments'

// Los gráficos traen Recharts (~107 kB gzip): se descargan en paralelo a los datos
// (la descarga parte al cargar este módulo) sin bloquear los KPIs ni la lista.
const donutModule = import('./SpendingDonut')
const barsModule = import('./IncomeExpenseChart')
const SpendingDonut = lazy(() => donutModule.then((m) => ({ default: m.SpendingDonut })))
const IncomeExpenseChart = lazy(() => barsModule.then((m) => ({ default: m.IncomeExpenseChart })))
const chartFallback = <span className="skeleton block h-64 w-full" role="status" aria-label="Cargando gráfico…" />

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

  if (loading) return <DashboardSkeleton />

  const active = accounts.filter((a) => !a.archived)
  if (active.length === 0) return <Onboarding />

  if (q.error) return <Alert>{q.error}</Alert>
  if (!q.data) return <DashboardSkeleton />
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
    <div className={`flex flex-col gap-8 transition-opacity duration-200 ${q.loading ? 'opacity-60' : ''}`} aria-busy={q.loading}>
      <PageHeader title="Resumen" subtitle={monthLabel(month)} />

      <Kpis totalBalance={totalBalance} current={current} previous={previous} />

      {alerts.length > 0 && (
        <section aria-labelledby="alertas">
          <SectionHeader id="alertas" title="Presupuestos en alerta" icon={TriangleAlert} iconClass="text-warn"
            action={<Link to="/presupuestos" className="link">Ver todos</Link>} />
          <ul className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2">
            {alerts.slice(0, 4).map(({ b, c, spent }) => (
              <li key={b.id}><BudgetProgress category={c!} spent={spent} amount={b.amount} /></li>
            ))}
          </ul>
        </section>
      )}

      <UpcomingPayments />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeader title="Gastos por categoría" />
          <Suspense fallback={chartFallback}><SpendingDonut spending={spending} /></Suspense>
        </Card>
        <Card>
          <SectionHeader title="Ingresos y gastos · 12 meses" />
          <Suspense fallback={chartFallback}><IncomeExpenseChart data={totals} /></Suspense>
        </Card>
      </div>

      <Card pad="none">
        <div className="px-5 pt-5 md:px-6"><SectionHeader title="Últimos movimientos"
          action={<Link to="/movimientos" className="link">Ver todos</Link>} /></div>
        {recent.length ? (
          <TransactionList rows={recent} onSelect={openEdit} grouped={false} />
        ) : (
          <div className="flex flex-col items-start gap-3 px-5 pb-5 md:px-6">
            <p className="text-sm text-soft">Aún no hay movimientos en {monthLabel(month)}.</p>
            <Button icon={Plus} onClick={() => openNew()}>Nueva transacción</Button>
          </div>
        )}
      </Card>
    </div>
  )
}

/** Esqueleto con la forma del resumen (sin saltos al cargar). */
function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8" role="status" aria-label="Cargando el resumen…">
      <div className="flex flex-col gap-2" aria-hidden>
        <span className="skeleton h-9 w-40" />
        <span className="skeleton h-4 w-28" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card flex flex-col gap-3 p-4">
            <span className="skeleton h-3 w-20" />
            <span className="skeleton h-7 w-28" />
            <span className="skeleton h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2" aria-hidden>
        <div className="card h-80 p-6"><span className="skeleton block h-full w-full" /></div>
        <div className="card h-80 p-6"><span className="skeleton block h-full w-full" /></div>
      </div>
    </div>
  )
}

function Onboarding() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Bienvenido" subtitle="Tu espacio para ordenar tus finanzas." />
      <EmptyState icon={Rocket} title="Empecemos en 3 pasos"
        action={<Link to="/cuentas" className={buttonLinkCls}>Crear mi primera cuenta <ArrowRight size={18} strokeWidth={2} aria-hidden /></Link>}>
        <ol className="list-decimal space-y-1.5 pl-5 text-left">
          <li>Crea una cuenta (efectivo, banco, ahorro o tarjeta) con su saldo actual.</li>
          <li>Registra tus movimientos con el botón <strong>Nueva transacción</strong>.</li>
          <li>Define presupuestos mensuales y te avisaremos al 80% y al 100%.</li>
        </ol>
        <p className="mt-3">Ya creamos tus categorías por defecto.</p>
      </EmptyState>
    </div>
  )
}
