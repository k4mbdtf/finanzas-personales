// Estructura de la app autenticada:
//  * Escritorio (md+): sidebar fija a la izquierda.
//  * Celular: barra inferior + botón flotante "+ Nueva transacción".
//  * Selector de mes arriba en las vistas que dependen del mes.
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { MonthProvider } from '@/context/Month'
import { RefDataProvider } from '@/context/RefData'
import { FeedbackProvider } from './Feedback'
import { MonthSelector } from './MonthSelector'
import { TransactionDrawerProvider, useTransactionDrawer } from '@/features/transactions/TransactionDrawer'

// Para agregar una sección nueva basta con sumarla aquí y en App.tsx.
// `mobile: false` => solo en la sidebar (en celular se llega desde otra vista).
const NAV = [
  { to: '/', label: 'Inicio', icon: '🏠', end: true },
  { to: '/movimientos', label: 'Movimientos', icon: '📋' },
  { to: '/presupuestos', label: 'Presupuestos', icon: '🎯' },
  { to: '/cuentas', label: 'Cuentas', icon: '🏦' },
  { to: '/categorias', label: 'Categorías', icon: '🏷️', mobile: false },
  { to: '/ajustes', label: 'Ajustes', icon: '⚙️' },
]
const MOBILE_NAV = NAV.filter((n) => n.mobile !== false)

/** Rutas donde se muestra el selector de mes. */
const MONTH_ROUTES = ['/', '/movimientos', '/presupuestos']

export function AppShell() {
  return (
    <FeedbackProvider>
      <RefDataProvider>
        <MonthProvider>
          <TransactionDrawerProvider>
            <Layout />
          </TransactionDrawerProvider>
        </MonthProvider>
      </RefDataProvider>
    </FeedbackProvider>
  )
}

function Layout() {
  const { pathname } = useLocation()
  const { openNew } = useTransactionDrawer()
  const showMonth = MONTH_ROUTES.includes(pathname)

  return (
    <div className="min-h-dvh md:flex">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-2">
        Saltar al contenido
      </a>

      {/* Sidebar (escritorio) */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-2 border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:flex">
        <p className="mb-4 px-2 text-lg font-bold">💰 Mis Finanzas</p>
        <button
          onClick={() => openNew()}
          className="mb-4 min-h-11 rounded-lg bg-teal-700 px-4 font-medium text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          + Nueva transacción
        </button>
        <nav aria-label="Principal" className="flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 font-medium ${isActive
                  ? 'bg-teal-50 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
              <span aria-hidden>{n.icon}</span>{n.label}
            </NavLink>
          ))}
        </nav>
        <button onClick={() => supabase.auth.signOut()}
          className="mt-auto rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
          ↩ Cerrar sesión
        </button>
      </aside>

      <div className="min-w-0 flex-1">
        {showMonth && (
          <header className="sticky top-0 z-10 flex justify-center border-b border-slate-200 bg-white/90 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
            <MonthSelector />
          </header>
        )}
        <main id="contenido" className="mx-auto max-w-4xl px-4 pt-6 pb-36 md:pb-10">
          <Outlet />
        </main>
      </div>

      {/* Botón flotante (celular) */}
      <button
        onClick={() => openNew()}
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 flex min-h-14 items-center gap-2 rounded-full bg-teal-700 px-5 font-semibold text-white shadow-lg active:scale-95 dark:bg-teal-600 md:hidden"
      >
        <span className="text-2xl leading-none" aria-hidden>+</span> Nueva transacción
      </button>

      {/* Barra inferior (celular) */}
      <nav aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-slate-800 dark:bg-slate-900 md:hidden">
        {MOBILE_NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) =>
              `flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${isActive
                ? 'text-teal-700 dark:text-teal-300'
                : 'text-slate-500 dark:text-slate-400'}`}>
            <span className="text-xl" aria-hidden>{n.icon}</span>{n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
