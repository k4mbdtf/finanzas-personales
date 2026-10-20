import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Logo } from '@/components/ui'

export default function PrivacyPage() {
  const h2 = 'mt-10 mb-3 text-[1.0625rem] font-semibold tracking-tight'
  return (
    <main className="animate-page mx-auto max-w-[68ch] px-4 py-10 leading-relaxed text-ink md:py-16">
      <div className="mb-10 flex items-center justify-between">
        <Logo />
        <Link to="/" className="link inline-flex items-center gap-1 text-sm"><ChevronLeft size={16} strokeWidth={2} aria-hidden />Volver</Link>
      </div>
      <p className="label-caps">Política</p>
      <h1 className="title-page mt-1">Privacidad</h1>

      <h2 className={h2}>Qué datos guardamos</h2>
      <ul className="list-disc space-y-1.5 pl-6 text-soft">
        <li>Tu correo electrónico y una versión cifrada (hash) de tu contraseña, para que puedas iniciar sesión.</li>
        <li>Los datos financieros que tú ingresas: cuentas, saldos iniciales, movimientos, notas, etiquetas, categorías, presupuestos, metas, deudas y las cartolas que importes.</li>
        <li>Datos técnicos mínimos de inicio de sesión (fecha del último acceso), gestionados por Supabase.</li>
      </ul>
      <p className="mt-3 text-soft">No conectamos tus cuentas bancarias, no guardamos datos de tarjetas y no vendemos ni compartimos tu información.</p>

      <h2 className={h2}>Quién puede ver tus datos</h2>
      <p className="text-soft">
        <strong className="text-ink">Solo tú.</strong> Cada registro está asociado a tu usuario y la base de datos aplica reglas de
        seguridad a nivel de fila (Row Level Security): ningún otro usuario de la aplicación puede leer,
        modificar ni borrar tu información, aunque conozca sus identificadores.
      </p>

      <h2 className={h2}>Dónde se guardan</h2>
      <p className="text-soft">En una base de datos PostgreSQL alojada en Supabase. La conexión siempre es cifrada (HTTPS).</p>

      <h2 className={h2}>Tus derechos</h2>
      <ul className="list-disc space-y-1.5 pl-6 text-soft">
        <li>Exportar tus datos (CSV/JSON) desde Ajustes.</li>
        <li>Eliminar tu cuenta y todos tus datos de forma permanente desde Ajustes.</li>
      </ul>
    </main>
  )
}
