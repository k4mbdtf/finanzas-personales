// Rutas de la aplicación.
// HashRouter (URLs tipo /#/ajustes): funciona en hosting estático como GitHub
// Pages sin configurar rewrites ni 404.html.
import { HashRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/auth/AuthProvider'
import { isConfigured } from '@/lib/supabase'
import { AppShell } from '@/components/AppShell'
import { Alert, FullScreenLoader } from '@/components/ui'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage'
import HomePage from '@/pages/HomePage'
import SettingsPage from '@/pages/SettingsPage'
import PrivacyPage from '@/pages/PrivacyPage'
import AccountsPage from '@/features/accounts/AccountsPage'
import TransactionsPage from '@/features/transactions/TransactionsPage'

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
              <Route index element={<HomePage />} />
              <Route path="/movimientos" element={<TransactionsPage />} />
              <Route path="/cuentas" element={<AccountsPage />} />
              <Route path="/ajustes" element={<SettingsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
