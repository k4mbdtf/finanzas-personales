// "Más" (celular): acceso a las secciones que no caben en la barra inferior.
import { Link } from 'react-router-dom'
import { ChevronRight, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { MORE_NAV } from '@/components/nav'
import { IconTile } from '@/components/icons'
import { PageHeader } from '@/components/ui'

export default function MorePage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Más" />
      <ul className="card stagger overflow-hidden">
        {MORE_NAV.map((n) => (
          <li key={n.to} className="border-b border-line last:border-0">
            <Link to={n.to} className="pressable flex items-center gap-3.5 px-4 py-3.5 hover:bg-subtle/60">
              <IconTile icon={n.icon} />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{n.label}</span>
                {n.hint && <span className="block text-xs leading-snug text-muted">{n.hint}</span>}
              </span>
              <ChevronRight size={18} strokeWidth={2} className="shrink-0 text-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <button onClick={() => supabase.auth.signOut()}
        className="card pressable flex items-center gap-3.5 px-4 py-3.5 text-left font-medium hover:bg-subtle/60">
        <span className="grid size-10 place-items-center rounded-lg bg-subtle text-soft" aria-hidden><LogOut size={20} strokeWidth={1.75} /></span>
        Cerrar sesión
      </button>
    </div>
  )
}
