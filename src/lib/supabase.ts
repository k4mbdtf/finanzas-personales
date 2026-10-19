// Cliente único de Supabase para el frontend.
// Usa SOLO la anon key (pública). La seguridad la garantiza RLS en la BD.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && anonKey)

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing', {
  auth: {
    // PKCE: el enlace del correo vuelve con ?code=... en la query, lo que
    // no choca con el #/ruta del HashRouter (el flujo implícito usa el hash).
    flowType: 'pkce',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
})

/** URL absoluta de la app (respeta el base path de GitHub Pages). */
export function appUrl(params = ''): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}${params}`
}
