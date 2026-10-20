// Cliente único de Supabase para el frontend.
// Usa SOLO la anon key (pública). La seguridad la garantiza RLS en la BD.
//
// Se arma solo con auth-js (sesión) y postgrest-js (tablas y RPC) en vez de
// createClient() de @supabase/supabase-js, que además trae realtime, storage y
// functions (la app no los usa): ~28 kB gzip menos en la carga inicial.
// Imita lo que hace createClient(): mismas URLs, mismos headers y la misma clave
// de sesión en localStorage, así nadie pierde su sesión al actualizar.
import { AuthClient } from '@supabase/auth-js'
import { PostgrestClient } from '@supabase/postgrest-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && anonKey)

const baseUrl = new URL(url ?? 'http://localhost')
const key = anonKey ?? 'missing'

const auth = new AuthClient({
  url: new URL('auth/v1', baseUrl).href,
  headers: { Authorization: `Bearer ${key}`, apikey: key },
  // Igual que supabase-js: sb-<ref del proyecto>-auth-token
  storageKey: `sb-${baseUrl.hostname.split('.')[0]}-auth-token`,
  // PKCE: el enlace del correo vuelve con ?code=... en la query, lo que
  // no choca con el #/ruta del HashRouter (el flujo implícito usa el hash).
  flowType: 'pkce',
  detectSessionInUrl: true,
  persistSession: true,
  autoRefreshToken: true,
})

/** Cada consulta va con el token de la sesión (o la anon key si no hay sesión): así aplica RLS. */
const fetchWithAuth: typeof fetch = async (input, init) => {
  const { data } = await auth.getSession()
  const headers = new Headers(init?.headers)
  if (!headers.has('apikey')) headers.set('apikey', key)
  if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${data.session?.access_token ?? key}`)
  return fetch(input, { ...init, headers })
}

const rest = new PostgrestClient(new URL('rest/v1', baseUrl).href, { fetch: fetchWithAuth })

/** Misma forma que el cliente de supabase-js para lo que usa la app. */
export const supabase = {
  auth,
  from: rest.from.bind(rest) as typeof rest.from,
  rpc: rest.rpc.bind(rest) as typeof rest.rpc,
}

/** URL absoluta de la app (respeta el base path de GitHub Pages). */
export function appUrl(params = ''): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}${params}`
}
