// Enlace "‹ Volver" para las pantallas de detalle.
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

export function BackLink({ to, children }: { to: string; children: string }) {
  return (
    <Link to={to}
      className="pressable -ml-1.5 inline-flex min-h-9 items-center gap-0.5 self-start rounded-sm pr-2 text-sm font-medium text-soft hover:text-ink">
      <ChevronLeft size={20} strokeWidth={2} aria-hidden />{children}
    </Link>
  )
}
