// Ajustes, agrupados como en la app de Configuración de iOS.
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Coins, Download, FileJson, FileSpreadsheet, Monitor, Moon, Shield, Sun, Tags, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthProvider'
import { useRefData } from '@/context/RefData'
import { setMultiCurrency } from '@/data/profile'
import { exportJSON, exportTransactionsCSV } from '@/data/export'
import { useInstallPrompt } from '@/lib/pwa'
import { getThemePref, setThemePref, type ThemePref } from '@/lib/theme'
import { ChangePasswordForm } from '@/components/ChangePasswordForm'
import { useToast } from '@/components/Feedback'
import { IconTile } from '@/components/icons'
import { Alert, Button, Card, Checkbox, Field, PageHeader, Segmented } from '@/components/ui'

const CONFIRM_WORD = 'ELIMINAR'

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="label-caps px-1">{title}</h2>
      {children}
    </section>
  )
}

export default function SettingsPage() {
  const { session } = useAuth()
  const email = session?.user.email ?? ''
  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <PageHeader title="Ajustes" />

      <Card pad="sm" className="flex items-center gap-4 md:p-5">
        <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-accent text-lg font-bold text-on-accent" aria-hidden>
          {email.charAt(0).toUpperCase() || '?'}
        </span>
        <div className="min-w-0">
          <p className="label-caps">Mi cuenta</p>
          <p className="truncate font-medium">{email}</p>
        </div>
      </Card>

      <Group title="Preferencias">
        <AppearanceCard />
        <CurrencyCard />
        <Link to="/categorias"
          className="card pressable flex items-center gap-3.5 px-4 py-3.5 transition-[border-color] duration-200 hover:border-line-strong/40">
          <IconTile icon={Tags} />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Categorías</span>
            <span className="block text-[0.8125rem] text-muted">Colores, íconos y categorías propias</span>
          </span>
          <ChevronRight size={18} strokeWidth={2} className="text-muted" aria-hidden />
        </Link>
      </Group>

      <InstallCard />

      <Group title="Tus datos">
        <ExportCard />
      </Group>

      <Group title="Seguridad">
        <Card>
          <h3 className="mb-4 font-semibold">Cambiar contraseña</h3>
          <ChangePasswordForm />
        </Card>
      </Group>

      <Group title="Zona de riesgo">
        <DeleteAccountCard />
      </Group>

      <p className="flex items-center justify-center gap-1.5 text-sm">
        <Shield size={15} strokeWidth={2} className="text-muted" aria-hidden />
        <Link to="/privacidad" className="link">Privacidad: qué datos guardamos</Link>
      </p>
    </div>
  )
}

function AppearanceCard() {
  const [pref, setPref] = useState<ThemePref>(getThemePref)
  return (
    <Card pad="sm" className="md:p-5">
      <h3 className="mb-3 font-semibold">Apariencia</h3>
      <Segmented<ThemePref>
        label="Tema"
        value={pref}
        onChange={(v) => { setPref(v); setThemePref(v) }}
        options={[
          { value: 'system', label: 'Sistema', icon: Monitor },
          { value: 'light', label: 'Claro', icon: Sun },
          { value: 'dark', label: 'Oscuro', icon: Moon },
        ]}
      />
    </Card>
  )
}

function InstallCard() {
  const { installed, canPrompt, ios, install } = useInstallPrompt()
  if (installed) return null
  return (
    <Group title="Aplicación">
      <Card pad="sm" className="md:p-5">
        <h3 className="mb-1 font-semibold">Instalar la app</h3>
        {canPrompt ? (
          <>
            <p className="mb-4 text-sm text-soft">Agrégala a tu pantalla de inicio para abrirla como una app.</p>
            <Button icon={Download} onClick={install}>Instalar</Button>
          </>
        ) : ios ? (
          <p className="text-sm leading-relaxed text-soft">
            En Safari toca <strong>Compartir</strong> y luego <strong>Agregar a inicio</strong>.
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-soft">
            Desde el menú del navegador elige <strong>Instalar aplicación</strong> o <strong>Agregar a la pantalla de inicio</strong>.
          </p>
        )}
      </Card>
    </Group>
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
    <Card pad="sm" className="md:p-5">
      <h3 className="mb-1 font-semibold">Exportar mis datos</h3>
      <p className="mb-4 text-sm text-soft">Descarga tu información. Solo incluye tus propios datos.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="secondary" icon={FileSpreadsheet} loading={busy === 'csv'} disabled={busy !== null} onClick={() => run('csv')}>
          Movimientos (CSV)
        </Button>
        <Button variant="secondary" icon={FileJson} loading={busy === 'json'} disabled={busy !== null} onClick={() => run('json')}>
          Respaldo completo (JSON)
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
    <Card className="border-neg/30">
      <h3 className="mb-2 font-semibold text-neg">Eliminar mi cuenta y todos mis datos</h3>
      <p className="mb-4 text-sm leading-relaxed text-soft">
        Se borrarán de forma permanente tu usuario, cuentas, movimientos, categorías, presupuestos, metas y deudas.
        Esta acción <strong>no se puede deshacer</strong>. Te recomendamos exportar tus datos antes.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}
        <Field label={`Escribe ${CONFIRM_WORD} para confirmar`} autoComplete="off" autoCapitalize="characters"
          value={word} onChange={(e) => setWord(e.target.value.toUpperCase())} />
        <Button type="submit" variant="danger" icon={Trash2} loading={busy} disabled={word !== CONFIRM_WORD}>
          Eliminar definitivamente
        </Button>
      </form>
    </Card>
  )
}

/** Opción "Usar UF y dólares": apagada, la app queda solo en pesos como siempre. */
function CurrencyCard() {
  const { multiCurrency, currencyAvailable, accounts } = useRefData()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  // La casilla cambia al tocarla; si no se puede guardar, vuelve a como estaba.
  const [checked, setChecked] = useState(multiCurrency)
  const [seen, setSeen] = useState(multiCurrency)
  if (seen !== multiCurrency) { setSeen(multiCurrency); setChecked(multiCurrency) }
  const hasForeign = accounts.some((a) => (a.currency ?? 'CLP') !== 'CLP')

  async function toggle(on: boolean) {
    setBusy(true)
    setChecked(on)
    try {
      await setMultiCurrency(on)
      toast(on ? 'Ahora puedes crear cuentas en UF y dólares' : 'Opción de UF y dólares desactivada')
    } catch (err) {
      setChecked(!on)
      toast(err instanceof Error ? err.message : 'No se pudo guardar.', 'error')
    }
    setBusy(false)
  }

  return (
    <Card pad="sm" className="flex flex-col gap-3 md:p-5">
      <div className="flex items-center gap-3">
        <IconTile icon={Coins} />
        <div className="min-w-0">
          <h3 className="font-semibold">UF y dólares</h3>
          <p className="text-[0.8125rem] text-muted">Cuentas en UF o USD y ver tus saldos en otra moneda.</p>
        </div>
      </div>
      {currencyAvailable ? (
        <Checkbox label="Usar UF y dólares" checked={checked} onChange={(on) => { if (!busy) void toggle(on) }}
          hint={checked
            ? 'Al crear una cuenta eliges su moneda, y en Cuentas puedes ver los saldos en pesos, UF o dólares. Los reportes siguen en pesos (al valor de cada día).'
            : hasForeign ? 'Tus cuentas en UF o USD se siguen mostrando en su moneda.' : 'Desactivado: todo se muestra en pesos, como siempre.'} />
      ) : (
        <Alert kind="info">
          Para usar UF y dólares, ejecuta <code>supabase/migrations/0009_multimoneda.sql</code> en el SQL Editor de Supabase
          (una sola vez).
        </Alert>
      )}
    </Card>
  )
}
