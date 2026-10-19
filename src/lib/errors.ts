// Traduce errores de Supabase a mensajes claros en español.
import type { AuthError, PostgrestError } from '@supabase/supabase-js'

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Correo o contraseña incorrectos.',
  email_not_confirmed: 'Debes confirmar tu correo antes de entrar. Revisa tu bandeja de entrada (y spam).',
  user_already_exists: 'Ya existe una cuenta con ese correo.',
  email_exists: 'Ya existe una cuenta con ese correo.',
  weak_password: 'La contraseña es muy débil. Usa al menos 8 caracteres, con letras y números.',
  same_password: 'La nueva contraseña debe ser distinta de la actual.',
  over_email_send_rate_limit: 'Se enviaron demasiados correos. Espera unos minutos e inténtalo de nuevo.',
  over_request_rate_limit: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  captcha_failed: 'No pudimos verificar el captcha. Vuelve a intentarlo.',
  validation_failed: 'Revisa los datos ingresados.',
  session_not_found: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  flow_state_not_found: 'El enlace expiró o se abrió en otro navegador. Solicita uno nuevo.',
  otp_expired: 'El enlace expiró. Solicita uno nuevo.',
}

export function authErrorMessage(error: AuthError | null | undefined): string {
  if (!error) return ''
  if (error.code && AUTH_MESSAGES[error.code]) return AUTH_MESSAGES[error.code]
  if (/fetch|network/i.test(error.message)) return 'Sin conexión con el servidor. Revisa tu internet.'
  return 'Ocurrió un error inesperado. Inténtalo de nuevo.'
}

export function dbErrorMessage(error: PostgrestError | null | undefined): string {
  if (!error) return ''
  switch (error.code) {
    case '23505': return 'Ya existe un registro con esos datos.'
    case '23503': return 'El registro está en uso o hace referencia a datos que no existen.'
    case '23514': return 'Los datos no cumplen las reglas (revisa montos, fechas y categorías).'
    case '42501': return 'No tienes permiso para realizar esta acción.'
    case 'PGRST301': return 'Tu sesión expiró. Vuelve a iniciar sesión.'
    default:
      if (/fetch|network/i.test(error.message)) return 'Sin conexión con el servidor. Revisa tu internet.'
      return 'No se pudo completar la operación. Inténtalo de nuevo.'
  }
}

/** Error con mensaje para el usuario y el código original de Postgres. */
export class AppError extends Error {
  code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

/** Devuelve `data` o lanza un AppError con mensaje en español. */
export function unwrap<T>(res: { data: T | null; error: PostgrestError | null }): T {
  if (res.error) throw new AppError(dbErrorMessage(res.error), res.error.code)
  return res.data as T
}
