import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { ChangePasswordForm } from '@/components/ChangePasswordForm'
import { Alert } from '@/components/ui'
import { AuthLayout, linkCls } from './AuthLayout'

/** Se llega aquí desde el enlace de "olvidé mi contraseña". */
export default function ResetPasswordPage() {
  const { session, clearRecovering } = useAuth()
  const navigate = useNavigate()

  if (!session) {
    return (
      <AuthLayout title="Enlace no válido" footer={<Link to="/recuperar" className={linkCls}>Solicitar un nuevo enlace</Link>}>
        <Alert>El enlace expiró o se abrió en un navegador distinto al que lo solicitó.</Alert>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Crea una nueva contraseña">
      <ChangePasswordForm
        onDone={() => {
          clearRecovering()
          setTimeout(() => navigate('/', { replace: true }), 1200)
        }}
      />
    </AuthLayout>
  )
}
