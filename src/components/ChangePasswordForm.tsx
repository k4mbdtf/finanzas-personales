// Formulario para definir una nueva contraseña. Se usa en:
//  * /restablecer (tras abrir el enlace de recuperación)
//  * /ajustes (cambio de contraseña con sesión iniciada)
import { useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { authErrorMessage } from '@/lib/errors'
import { validatePassword } from '@/pages/auth/password'
import { Alert, Button, Field } from './ui'

export function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)

  const pwError = password ? validatePassword(password) : ''
  const confirmError = confirm && confirm !== password ? 'Las contraseñas no coinciden.' : ''

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (pwError || confirmError) return
    setError('')
    setOk(false)
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setError(authErrorMessage(error))
    setOk(true)
    setPassword('')
    setConfirm('')
    onDone?.()
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error && <Alert>{error}</Alert>}
      {ok && <Alert kind="success">Contraseña actualizada.</Alert>}
      <Field label="Nueva contraseña" type="password" autoComplete="new-password" required
        hint="Mínimo 8 caracteres, con letras y números." error={pwError}
        value={password} onChange={(e) => setPassword(e.target.value)} />
      <Field label="Repite la nueva contraseña" type="password" autoComplete="new-password" required
        error={confirmError} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <Button type="submit" loading={busy} disabled={!password || !confirm || !!pwError || !!confirmError}>
        Guardar contraseña
      </Button>
    </form>
  )
}
