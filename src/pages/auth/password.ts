/** Validación de contraseña en el cliente (Supabase también la valida en el servidor). */
export function validatePassword(pw: string): string {
  if (pw.length < 8) return 'Debe tener al menos 8 caracteres.'
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return 'Debe incluir letras y números.'
  return ''
}
