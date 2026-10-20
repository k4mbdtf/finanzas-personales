// Rutas de la aplicación.
// HashRouter (URLs tipo /#/ajustes): funciona en hosting estático como GitHub
// Pages sin configurar rewrites ni 404.html.
import { lazy, Suspense, type ReactNode } from 'react'
import { HashRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/auth/AuthProvider'
import { isConfigured } from '@/lib/supabase'
import { AppShell } from '@/components/AppShell'
import { Alert, FullScreenLoader, Loading } from '@/components/ui'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage'
import PrivacyPage from '@/pages/PrivacyPage'
import AccountsPage from '@/features/accounts/AccountsPage'
import TransactionsPage from '@/features/transactions/TransactionsPage'
import MorePage from '@/pages/MorePage'

// Carga diferida: cada pantalla secundaria se descarga recién al abrirla, así la
// app abre rápido en el celular (las de gráficos traen Recharts, ~100 kB).
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'))
const NetWorthPage = lazy(() => import('@/features/networth/NetWorthPage'))
const BudgetsPage = lazy(() => import('@/features/budgets/BudgetsPage'))
const CategoriesPage = lazy(() => import('@/features/categories/CategoriesPage'))
const DebtsPage = lazy(() => import('@/features/debts/DebtsPage'))
const DebtDetailPage = lazy(() => import('@/features/debts/DebtDetailPage'))
const InvestmentsPage = lazy(() => import('@/features/investments/InvestmentsPage'))
const InvestmentDetailPage = lazy(() => import('@/features/investments/InvestmentDetailPage'))
const GoalsPage = lazy(() => import('@/features/goals/GoalsPage'))
const RecurringPage = lazy(() => import('@/features/recurring/RecurringPage'))
const ImportPage = lazy(() => import('@/features/import/ImportPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))

const page = (el: ReactNode) => <Suspense fallback={<Loading label="Cargando…" />}>{el}</Suspense>

/** Solo usuarios con sesión. Si viene de un enlace de recuperación, lo manda a /restablecer. */
function RequireAuth() {
  const { session, loading, recovering } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenLoader />
  if (recovering) return <Navigate to="/restablecer" replace />
  if (!session) return <Navigate to="/ingresar" replace state={{ from: location.pathname }} />
  return <Outlet />
}

/** Pantallas públicas: si ya hay sesión, ir al inicio. */
function PublicOnly() {
  const { session, loading, recovering } = useAuth()
  if (loading) return <FullScreenLoader />
  if (recovering) return <Navigate to="/restablecer" replace />
  if (session) return <Navigate to="/" replace />
  return <Outlet />
}

export default function App() {
  if (!isConfigured) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Alert>
          Falta configurar Supabase. Copia <code>.env.example</code> a <code>.env.local</code> y completa
          <code> VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code>.
        </Alert>
      </div>
    )
  }

  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route element={<PublicOnly />}>
            <Route path="/ingresar" element={<LoginPage />} />
            <Route path="/registro" element={<RegisterPage />} />
            <Route path="/recuperar" element={<ForgotPasswordPage />} />
          </Route>
          <Route path="/restablecer" element={<ResetPasswordPage />} />
          <Route path="/privacidad" element={<PrivacyPage />} />

          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route index element={page(<DashboardPage />)} />
              <Route path="/movimientos" element={<TransactionsPage />} />
              <Route path="/cuentas" element={<AccountsPage />} />
              <Route path="/presupuestos" element={page(<BudgetsPage />)} />
              <Route path="/categorias" element={page(<CategoriesPage />)} />
              <Route path="/deudas" element={page(<DebtsPage />)} />
              <Route path="/deudas/:id" element={page(<DebtDetailPage />)} />
              <Route path="/inversiones" element={page(<InvestmentsPage />)} />
              <Route path="/inversiones/:id" element={page(<InvestmentDetailPage />)} />
              <Route path="/metas" element={page(<GoalsPage />)} />
              <Route path="/recurrentes" element={page(<RecurringPage />)} />
              <Route path="/importar" element={page(<ImportPage />)} />
              <Route path="/patrimonio" element={page(<NetWorthPage />)} />
              <Route path="/mas" element={<MorePage />} />
              <Route path="/ajustes" element={page(<SettingsPage />)} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
