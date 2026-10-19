import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthProvider'
import { ChangePasswordForm } from '@/components/ChangePasswordForm'
import { Alert, Button, Card, Field } from '@/components/ui'

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

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Cambiar contraseña</h2>
        <ChangePasswordForm />
      </Card>

      <DeleteAccountCard />
    </div>
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
