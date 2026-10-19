import { Link } from 'react-router-dom'

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 leading-relaxed text-slate-800 dark:text-slate-200">
      <h1 className="mb-6 text-2xl font-bold">Privacidad</h1>

      <h2 className="mt-6 mb-2 text-lg font-semibold">Qué datos guardamos</h2>
      <ul className="list-disc space-y-1 pl-6">
        <li>Tu correo electrónico y una versión cifrada (hash) de tu contraseña, para que puedas iniciar sesión.</li>
        <li>Los datos financieros que tú ingresas: cuentas, saldos iniciales, transacciones, notas, etiquetas, categorías y presupuestos.</li>
        <li>Datos técnicos mínimos de inicio de sesión (fecha del último acceso), gestionados por Supabase.</li>
      </ul>
      <p className="mt-2">No conectamos tus cuentas bancarias, no guardamos datos de tarjetas y no vendemos ni compartimos tu información.</p>

      <h2 className="mt-6 mb-2 text-lg font-semibold">Quién puede ver tus datos</h2>
      <p>
        <strong>Solo tú.</strong> Cada registro está asociado a tu usuario y la base de datos aplica reglas de
        seguridad a nivel de fila (Row Level Security): ningún otro usuario de la aplicación puede leer,
        modificar ni borrar tu información, aunque conozca sus identificadores.
      </p>

      <h2 className="mt-6 mb-2 text-lg font-semibold">Dónde se guardan</h2>
      <p>En una base de datos PostgreSQL alojada en Supabase. La conexión siempre es cifrada (HTTPS).</p>

      <h2 className="mt-6 mb-2 text-lg font-semibold">Tus derechos</h2>
      <ul className="list-disc space-y-1 pl-6">
        <li>Exportar tus datos (CSV/JSON) desde Ajustes.</li>
        <li>Eliminar tu cuenta y todos tus datos de forma permanente desde Ajustes.</li>
      </ul>

      <p className="mt-8"><Link to="/" className="font-medium text-teal-700 underline dark:text-teal-400">← Volver</Link></p>
    </main>
  )
}
