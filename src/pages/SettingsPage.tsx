import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthProvider'
import { exportJSON, exportTransactionsCSV } from '@/data/export'
import { useInstallPrompt } from '@/lib/pwa'
import { getThemePref, setThemePref, type ThemePref } from '@/lib/theme'
import { ChangePasswordForm } from '@/components/ChangePasswordForm'
import { useToast } from '@/components/Feedback'
import { Alert, Button, Card, Field, Segmented } from '@/components/ui'

const CONFIRM_WORD = 'ELIMINAR'

export default function SettingsPage() {
  const { session } = useAuth()
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Ajustes</h1>

      <Card>
        <h2 className="mb-1 text-lg font-semibold">Mi cuenta</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">{session?.user.email}</p>
      </Card>

      <Link to="/categorias"
        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 font-semibold shadow-sm hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800">
        <span><span aria-hidden>🏷️ </span>Categorías</span>
        <span className="text-sm font-normal text-slate-500 dark:text-slate-400">Colores, íconos y personalizadas ›</span>
      </Link>

      <AppearanceCard />
      <InstallCard />
      <ExportCard />

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Cambiar contraseña</h2>
        <ChangePasswordForm />
      </Card>

      <DeleteAccountCard />

      <p className="text-center text-sm">
        <Link to="/privacidad" className="text-teal-700 underline dark:text-teal-400">Privacidad: qué datos guardamos</Link>
      </p>
    </div>
  )
}

function AppearanceCard() {
  const [pref, setPref] = useState<ThemePref>(getThemePref)
  return (
    <Card>
      <h2 className="mb-3 text-lg font-semibold">Apariencia</h2>
      <Segmented<ThemePref>
        label="Tema"
        value={pref}
        onChange={(v) => { setPref(v); setThemePref(v) }}
        options={[
          { value: 'system', label: '🖥️ Sistema' },
          { value: 'light', label: '☀️ Claro' },
          { value: 'dark', label: '🌙 Oscuro' },
        ]}
      />
    </Card>
  )
}

function InstallCard() {
  const { installed, canPrompt, ios, install } = useInstallPrompt()
  if (installed) return null
  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold">Instalar la app</h2>
      {canPrompt ? (
        <>
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">Agrégala a tu pantalla de inicio para abrirla como una app.</p>
          <Button onClick={install}>📲 Instalar</Button>
        </>
      ) : ios ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          En Safari toca <strong>Compartir</strong> <span aria-hidden>⎋</span> y luego <strong>Agregar a inicio</strong>.
        </p>
      ) : (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Desde el menú del navegador elige <strong>Instalar aplicación</strong> o <strong>Agregar a la pantalla de inicio</strong>.
        </p>
      )}
    </Card>
  )
}

function ExportCard() {
  const toast = useToast()
  const [busy, setBusy] = useState<'csv' | 'json' | null>(null)

  async function run(kind: 'csv' | 'json') {
    setBusy(kind)
    try {
      const n = kind === 'csv' ? await exportTransactionsCSV() : await exportJSON()
      toast(`Exportación lista (${n} movimiento${n === 1 ? '' : 's'})`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo exportar', 'error')
    }
    setBusy(null)
  }

  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold">Exportar mis datos</h2>
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
        Descarga tu información. Solo incluye tus propios datos.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="secondary" loading={busy === 'csv'} disabled={busy !== null} onClick={() => run('csv')}>
          📄 Movimientos (CSV para Excel)
        </Button>
        <Button variant="secondary" loading={busy === 'json'} disabled={busy !== null} onClick={() => run('json')}>
          🗂️ Respaldo completo (JSON)
        </Button>
      </div>
    </Card>
  )
}

function DeleteAccountCard() {
  const navigate = useNavigate()
  const [word, setWord] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (word !== CONFIRM_WORD) return
    setBusy(true)
    setError('')
    // Borra auth.users del usuario actual; la BD elimina todo en cascada.
    const { error } = await supabase.rpc('delete_my_account')
    if (error) {
      setBusy(false)
      return setError('No se pudo eliminar la cuenta. Inténtalo de nuevo.')
    }
    await supabase.auth.signOut({ scope: 'local' })
    navigate('/ingresar', { replace: true })
  }

  return (
    <Card className="border-red-300 dark:border-red-800">
      <h2 className="mb-2 text-lg font-semibold text-red-800 dark:text-red-300">Eliminar mi cuenta y todos mis datos</h2>
      <p className="mb-4 text-sm text-slate-700 dark:text-slate-300">
        Se borrarán de forma permanente tu usuario, cuentas, transacciones, categorías y presupuestos.
        Esta acción <strong>no se puede deshacer</strong>. Te recomendamos exportar tus datos antes.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}
        <Field label={`Escribe ${CONFIRM_WORD} para confirmar`} autoComplete="off" autoCapitalize="characters"
          value={word} onChange={(e) => setWord(e.target.value.toUpperCase())} />
        <Button type="submit" variant="danger" loading={busy} disabled={word !== CONFIRM_WORD}>
          Eliminar definitivamente
        </Button>
      </form>
    </Card>
  )
}
