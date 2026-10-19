// Utilidades compartidas por seed.mjs y test-isolation.mjs.
// SOLO para uso local: usan la service_role key, que NUNCA debe ir al frontend.
import { createClient } from '@supabase/supabase-js'

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltan variables. Copia scripts/.env.scripts.example a scripts/.env.scripts y complétalo.')
  process.exit(1)
}

export const PASSWORD = 'Prueba-12345!'
export const TEST_USERS = [
  { email: 'ana.test@example.com', name: 'Ana' },
  { email: 'bruno.test@example.com', name: 'Bruno' },
  { email: 'carla.test@example.com', name: 'Carla' },
]

const opts = { auth: { persistSession: false, autoRefreshToken: false } }

/** Cliente admin (salta RLS). Solo para crear/borrar usuarios de prueba. */
export const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, opts)

/** Cliente con la anon key autenticado como un usuario (sujeto a RLS). */
export async function clientFor(email) {
  const c = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts)
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw new Error(`Login de ${email} falló: ${error.message} (¿captcha activo? ver README)`)
  return { client: c, userId: data.user.id }
}

/** Crea el usuario de prueba (ya confirmado) si no existe. */
export async function ensureUser(email) {
  const { error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
  })
  if (error && !/already|registered|exists/i.test(error.message)) throw error
}

export async function deleteUserByEmail(email) {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const u = data?.users?.find((x) => x.email === email)
  if (u) await admin.auth.admin.deleteUser(u.id)
}
