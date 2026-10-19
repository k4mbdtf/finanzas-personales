// "Más" (celular): acceso a las secciones que no caben en la barra inferior.
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { MORE_NAV } from '@/components/nav'

export default function MorePage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Más</h1>
      <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        {MORE_NAV.map((n) => (
          <li key={n.to} className="border-b border-slate-100 last:border-0 dark:border-slate-700">
            <Link to={n.to} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-lg dark:bg-slate-700" aria-hidden>{n.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{n.label}</span>
                {n.hint && <span className="block text-xs text-slate-500 dark:text-slate-400">{n.hint}</span>}
              </span>
              <span className="text-slate-400" aria-hidden>›</span>
            </Link>
          </li>
        ))}
      </ul>
      <button onClick={() => supabase.auth.signOut()}
        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
        ↩ Cerrar sesión
      </button>
    </div>
  )
}
