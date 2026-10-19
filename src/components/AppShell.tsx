// Estructura de la app autenticada.
// Fase 1: barra superior simple. En fases 2–4 se agrega sidebar (escritorio),
// barra inferior (celular), selector de mes y botón "+ Nueva transacción".
import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

const navCls = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium ${isActive
    ? 'bg-teal-50 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200'
    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`

export function AppShell() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
        <nav className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2" aria-label="Principal">
          <span className="mr-auto font-bold">💰 Mis Finanzas</span>
          <NavLink to="/" end className={navCls}>Inicio</NavLink>
          <NavLink to="/ajustes" className={navCls}>Ajustes</NavLink>
          <button
            onClick={() => supabase.auth.signOut()}
            className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Salir
          </button>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
