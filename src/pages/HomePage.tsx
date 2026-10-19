// Inicio provisional: guía de primer uso + últimos movimientos.
// El dashboard con KPIs y gráficos se construye en la Fase 4.
import { Link } from 'react-router-dom'
import { useMonth } from '@/context/Month'
import { useRefData } from '@/context/RefData'
import { listTransactions } from '@/data/transactions'
import { useQuery } from '@/hooks/useQuery'
import { monthRange } from '@/lib/dates'
import { Alert, Button, Card, EmptyState, Spinner } from '@/components/ui'
import { TransactionList } from '@/features/transactions/TransactionList'
import { useTransactionDrawer } from '@/features/transactions/TransactionDrawer'

export default function HomePage() {
  const { month } = useMonth()
  const { accounts, loading } = useRefData()
  const { openNew, openEdit } = useTransactionDrawer()
  const recent = useQuery(() => listTransactions(monthRange(month), 5), [month], ['transactions'])

  if (loading) return <Spinner label="Cargando…" />

  if (!accounts.some((a) => !a.archived)) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">¡Bienvenido! 👋</h1>
        <EmptyState icon="🚀" title="Empecemos en 2 pasos"
          action={<Link to="/cuentas" className="font-medium text-teal-700 underline dark:text-teal-400">1. Crear mi primera cuenta →</Link>}>
          <ol className="list-decimal space-y-1 pl-5 text-left">
            <li>Crea una cuenta (efectivo, banco, ahorro o tarjeta) con su saldo actual.</li>
            <li>Registra tus movimientos con el botón <strong>+ Nueva transacción</strong>.</li>
          </ol>
          <p className="mt-2">Ya creamos tus categorías por defecto.</p>
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Inicio</h1>
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Últimos movimientos</h2>
          <Link to="/movimientos" className="text-sm font-medium text-teal-700 underline dark:text-teal-400">Ver todos</Link>
        </div>
        {recent.error && <Alert>{recent.error}</Alert>}
        {recent.loading && !recent.data ? (
          <Spinner />
        ) : recent.data?.rows.length ? (
          <TransactionList rows={recent.data.rows} onSelect={openEdit} grouped={false} />
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">Aún no hay movimientos este mes.</p>
            <Button onClick={() => openNew()}>+ Nueva transacción</Button>
          </div>
        )}
      </Card>
    </div>
  )
}
