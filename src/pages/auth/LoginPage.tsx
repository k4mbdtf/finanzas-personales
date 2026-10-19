import { useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { authErrorMessage } from '@/lib/errors'
import { useAuth } from '@/auth/AuthProvider'
import { Alert, Button, Field } from '@/components/ui'
import { Turnstile, captchaEnabled, type TurnstileHandle } from '@/components/Turnstile'
import { AuthLayout, linkCls } from './AuthLayout'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { urlError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [error, setError] = useState(
    urlError ? 'El enlace del correo no es válido o expiró. Si ya confirmaste tu cuenta, inicia sesión.' : '',
  )
  const [busy, setBusy] = useState(false)
  const captchaRef = useRef<TurnstileHandle>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
      options: { captchaToken: captcha ?? undefined },
    })
    setBusy(false)
    captchaRef.current?.reset()
    if (error) return setError(authErrorMessage(error))
    const to = (location.state as { from?: string } | null)?.from ?? '/'
    navigate(to, { replace: true })
  }

  return (
    <AuthLayout
      title="Iniciar sesión"
      footer={<>¿No tienes cuenta? <Link to="/registro" className={linkCls}>Regístrate</Link></>}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <Field label="Correo" type="email" autoComplete="email" inputMode="email" required
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Contraseña" type="password" autoComplete="current-password" required
          value={password} onChange={(e) => setPassword(e.target.value)} />
        <Turnstile ref={captchaRef} onToken={setCaptcha} />
        <Button type="submit" loading={busy}
          disabled={!email || !password || (captchaEnabled && !captcha)}>
          Entrar
        </Button>
        <Link to="/recuperar" className={`text-center text-sm ${linkCls}`}>Olvidé mi contraseña</Link>
      </form>
    </AuthLayout>
  )
}
