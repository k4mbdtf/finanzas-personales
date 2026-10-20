import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { appUrl, supabase } from '@/lib/supabase'
import { authErrorMessage } from '@/lib/errors'
import { Alert, Button, Field } from '@/components/ui'
import { Turnstile, captchaEnabled, type TurnstileHandle } from '@/components/Turnstile'
import { AuthLayout, linkCls } from './AuthLayout'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const captchaRef = useRef<TurnstileHandle>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    // El enlace vuelve a la raíz de la app; AuthProvider detecta el evento
    // PASSWORD_RECOVERY y App redirige a /restablecer.
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: appUrl(),
      captchaToken: captcha ?? undefined,
    })
    setBusy(false)
    captchaRef.current?.reset()
    if (error) return setError(authErrorMessage(error))
    setSent(true)
  }

  return (
    <AuthLayout title="Recuperar contraseña" footer={<Link to="/ingresar" className={linkCls}>Volver a iniciar sesión</Link>}>
      {sent ? (
        <Alert kind="success">
          Si existe una cuenta con <strong>{email}</strong>, te llegará un enlace para crear una nueva contraseña.
          Ábrelo en este mismo navegador.
        </Alert>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {error && <Alert>{error}</Alert>}
          <Field label="Correo" type="email" autoComplete="email" inputMode="email" required
            value={email} onChange={(e) => setEmail(e.target.value)} />
          <Turnstile ref={captchaRef} onToken={setCaptcha} />
          <Button type="submit" size="lg" loading={busy} disabled={!email || (captchaEnabled && !captcha)}>
            Enviar enlace
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
