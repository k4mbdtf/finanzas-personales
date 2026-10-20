// Estructura de la app autenticada:
//  * Escritorio (md+): sidebar fija a la izquierda.
//  * Celular: barra inferior translúcida + botón flotante "Nueva transacción".
//  * Selector de mes arriba en las vistas que dependen del mes.
//  * Cada página entra con un fundido suave (key = ruta).
import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Ellipsis, LogOut, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthProvider'
import { MonthProvider } from '@/context/Month'
import { RefDataProvider } from '@/context/RefData'
import { materializeRecurring } from '@/data/recurring'
import { FeedbackProvider, useToast } from './Feedback'
import { MonthSelector } from './MonthSelector'
import { MAIN_NAV, MORE_NAV, type NavItem } from './nav'
import { Logo } from './ui'
import { TransactionDrawerProvider, useTransactionDrawer } from '@/features/transactions/TransactionDrawer'

/** En celular: las 4 principales + "Más" (que abre /mas con el resto). */
const MOBILE_NAV: NavItem[] = [...MAIN_NAV, { to: '/mas', label: 'Más', icon: Ellipsis }]
const MORE_PATHS = ['/mas', ...MORE_NAV.map((n) => n.to)]

/**
 * Genera una vez por carga de la app y por usuario los movimientos recurrentes
 * pendientes (si otra persona inicia sesión en la misma pestaña, se generan los suyos).
 */
let recurringCheckedFor: string | null = null
function useMaterializeRecurring() {
  const toast = useToast()
  const userId = useAuth().session?.user.id
  useEffect(() => {
    if (!userId || recurringCheckedFor === userId) return
    recurringCheckedFor = userId
    materializeRecurring()
      .then((n) => { if (n > 0) toast(`Se registraron ${n} movimiento${n === 1 ? '' : 's'} recurrente${n === 1 ? '' : 's'}`) })
      .catch(() => {
        // Se reintenta en la próxima carga (si no cambió el usuario entretanto).
        if (recurringCheckedFor === userId) recurringCheckedFor = null
      })
  }, [toast, userId])
}

/** Rutas sin botón flotante (no son de registro: evita tapar contenido). */
const NO_FAB_ROUTES = ['/ajustes', '/mas', '/categorias', '/importar']

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

function SideLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink to={item.to} end={item.end}
      className={({ isActive }) =>
        `group relative flex min-h-10 items-center gap-3 rounded-sm px-3 text-[0.9375rem] transition-colors duration-200 ${isActive
          ? 'bg-subtle font-semibold text-ink'
          : 'font-medium text-soft hover:bg-subtle/70 hover:text-ink'}`}>
      {({ isActive }) => (
        <>
          {/* Indicador del design.md: barra carbón a la izquierda del ítem activo. */}
          <span aria-hidden className={`absolute inset-y-2 left-0 w-[3px] rounded-r-xs bg-ink transition-[opacity,transform] duration-300 ease-soft ${
            isActive ? 'scale-y-100 opacity-100' : 'scale-y-50 opacity-0'}`} />
          <Icon size={18} strokeWidth={isActive ? 2.25 : 1.75} aria-hidden />
          {item.label}
        </>
      )}
    </NavLink>
  )
}

function Layout() {
  const { pathname } = useLocation()
  const { session } = useAuth()
  const { openNew } = useTransactionDrawer()
  const showMonth = MONTH_ROUTES.includes(pathname)
  const showFab = !NO_FAB_ROUTES.includes(pathname)
  useMaterializeRecurring()
  // Cada sección nueva parte desde arriba (si no, hereda el scroll de la anterior).
  useEffect(() => { window.scrollTo({ top: 0 }) }, [pathname])

  return (
    <div className="min-h-dvh md:flex">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:z-[500] focus:bg-surface focus:p-3">
        Saltar al contenido
      </a>

      {/* Sidebar (escritorio) */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="px-5 pt-6 pb-5"><Logo /></div>
        <div className="px-4 pb-4">
          <button onClick={() => openNew()}
            className="pressable flex min-h-11 w-full items-center justify-center gap-2 rounded-sm bg-accent px-4 font-semibold text-on-accent shadow-[0_1px_2px_rgb(0_0_0/0.1)] hover:bg-accent-hover">
            <Plus size={18} strokeWidth={2.25} aria-hidden /> Nueva transacción
          </button>
        </div>
        <nav aria-label="Principal" className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-4">
          {MAIN_NAV.map((n) => <SideLink key={n.to} item={n} />)}
          <p className="label-caps mt-5 mb-1.5 px-3">Más</p>
          {MORE_NAV.map((n) => <SideLink key={n.to} item={n} />)}
        </nav>
        <div className="flex items-center gap-2 border-t border-line px-5 py-4">
          <span className="min-w-0 flex-1 truncate text-xs text-muted" title={session?.user.email}>{session?.user.email}</span>
          <button onClick={() => supabase.auth.signOut()} aria-label="Cerrar sesión" title="Cerrar sesión"
            className="pressable grid size-9 place-items-center rounded-sm text-soft hover:bg-subtle hover:text-ink">
            <LogOut size={18} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {showMonth && (
          <header className="glass sticky top-0 z-[100] flex justify-center border-b border-line px-4 py-2">
            <MonthSelector />
          </header>
        )}
        <main id="contenido" className="mx-auto w-full max-w-[72rem] px-4 pt-6 pb-40 md:px-10 md:pt-10 md:pb-16">
          <div key={pathname} className="animate-page">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Botón flotante (celular) */}
      {showFab && <button onClick={() => openNew()}
        className="pressable animate-fade fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[100] flex min-h-13 items-center gap-2 rounded-lg bg-accent px-5 font-semibold text-on-accent shadow-[var(--shadow-float)] md:hidden">
        <Plus size={20} strokeWidth={2.25} aria-hidden /> Nueva transacción
      </button>}

      {/* Barra inferior (celular), material translúcido como en iOS */}
      <nav aria-label="Principal"
        className="glass fixed inset-x-0 bottom-0 z-[100] grid grid-cols-5 border-t border-line pb-[env(safe-area-inset-bottom)] md:hidden">
        {MOBILE_NAV.map((n) => {
          const Icon = n.icon
          const inMore = n.to === '/mas' && MORE_PATHS.includes(pathname)
          return (
            <NavLink key={n.to} to={n.to} end={n.end}
              // "Más" queda activo también en las secciones a las que se llega desde ahí.
              aria-current={inMore ? 'page' : undefined}
              className={({ isActive }) =>
                `pressable relative flex min-h-16 flex-col items-center justify-center gap-1 text-[10.5px] font-medium tracking-[0.01em] transition-colors duration-200 ${
                  isActive || inMore ? 'text-ink' : 'text-muted'}`}>
              {({ isActive }) => {
                const on = isActive || inMore
                return (
                  <>
                    <span aria-hidden className={`absolute top-0 h-0.5 w-8 rounded-b-xs bg-ink transition-[opacity,transform] duration-300 ease-soft ${
                      on ? 'scale-x-100 opacity-100' : 'scale-x-50 opacity-0'}`} />
                    <Icon size={22} strokeWidth={on ? 2.25 : 1.75} aria-hidden />
                    {n.label}
                  </>
                )
              }}
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
