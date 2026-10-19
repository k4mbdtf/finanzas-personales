import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { appUrl, supabase } from '@/lib/supabase'
import { authErrorMessage } from '@/lib/errors'
import { Alert, Button, Field } from '@/components/ui'
import { Turnstile, captchaEnabled, type TurnstileHandle } from '@/components/Turnstile'
import { AuthLayout, linkCls } from './AuthLayout'
import { validatePassword } from './password'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const captchaRef = useRef<TurnstileHandle>(null)

  const pwError = password ? validatePassword(password) : ''
  const confirmError = confirm && confirm !== password ? 'Las contraseñas no coinciden.' : ''

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (pwError || confirmError) return
    setError('')
    setBusy(true)
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: appUrl(), captchaToken: captcha ?? undefined },
    })
    setBusy(false)
    captchaRef.current?.reset()
    if (error) return setError(authErrorMessage(error))
    // Por seguridad Supabase no revela si el correo ya existía: siempre mostramos lo mismo.
    setSent(true)
  }

  if (sent) {
    return (
      <AuthLayout title="Revisa tu correo" footer={<Link to="/ingresar" className={linkCls}>Volver a iniciar sesión</Link>}>
        <Alert kind="success">
          Te enviamos un enlace de confirmación a <strong>{email}</strong>. Ábrelo para activar tu cuenta
          (revisa también spam). Si ya tenías cuenta, inicia sesión o recupera tu contraseña.
        </Alert>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Crear cuenta"
      footer={<>¿Ya tienes cuenta? <Link to="/ingresar" className={linkCls}>Inicia sesión</Link></>}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <Field label="Correo" type="email" autoComplete="email" inputMode="email" required
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Contraseña" type="password" autoComplete="new-password" required
          hint="Mínimo 8 caracteres, con letras y números." error={pwError}
          value={password} onChange={(e) => setPassword(e.target.value)} />
        <Field label="Repite la contraseña" type="password" autoComplete="new-password" required
          error={confirmError} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input type="checkbox" className="mt-1 size-4" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
          <span>Leí la <Link to="/privacidad" className={linkCls}>política de privacidad</Link>.</span>
        </label>
        <Turnstile ref={captchaRef} onToken={setCaptcha} />
        <Button type="submit" loading={busy}
          disabled={!email || !password || !!pwError || !!confirmError || !confirm || !accepted || (captchaEnabled && !captcha)}>
          Crear cuenta
        </Button>
      </form>
    </AuthLayout>
  )
}
